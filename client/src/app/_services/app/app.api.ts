import { AuthService } from '../auth.service';
import { map } from 'rxjs/operators';
import { Observable, of, from, Subject } from 'rxjs';
import { environment } from '@environments/environment';
import { VideoManager } from './managers/video.manager';

declare const AWS: any;

export class AppAPI {
    private S3: any;

    constructor(private auth: AuthService) {
        AWS.config.credentials = new AWS.Credentials(environment.awsAccessKey, environment.awsSecret);
        this.S3 = new AWS.S3();
    }

    public getAllVideos(): Observable<Array<App.Video>> {
        const result = new Subject<Array<App.Video>>();

        this.S3.listObjects({ Bucket: environment.awsBucket }, (error, data) => {
            if (error) { result.error(error); return; }

            const keys: Array<string> = data.Contents.map(o => o.Key);
            const videos = keys.filter(o => o.toLowerCase().endsWith('.mp4')).map(o => App.Video.fromJSON({ id: o, path: o }));

            const videoMap: { [key: string]: App.Video } = {};
            videos.forEach(o => {
                const key = o.id.replace(/\.[mM][pP]4$/, '');
                videoMap[key] = o;
            });

            keys.forEach(o => {
                const parts = o.split('/');
                const key = parts.slice(0, -1).join('/');
                if (!videoMap[key]) { return; }
                videoMap[key].state = App.VideoState.COMPLETE;
                videoMap[key].images.push(App.Image.fromJSON({ path: o }));
            });

            videos.forEach(video => {
                video.images.sort((a, b) => {
                    const A = parseInt(a.url.match(/_([0-9]+).jpg$/)[1]);
                    const B = parseInt(b.url.match(/_([0-9]+).jpg$/)[1]);
                    return A < B ? -1 : (A > B ? 1 : 0);
                });
            });

            result.next(videos);
            result.complete();
        });

        return result;
    }

    public getAllJobStatuses(): Observable<any> {
        return this.auth.GET('/jobStatus', {}).pipe(map(response => {
            return response.body;
        }));
    }

    public processVideo(video: App.Video): Observable<void> {
        return this.auth.POST('/processVideo', {}, {
            Accept: 'text/plain',
        }, {
            video: video.url,
        }).pipe(map(() => { }));
    }

    public getImageData(image: App.Image): Observable<Blob> {
        // https://stackoverflow.com/questions/16799956/javascript-to-download-a-file-from-amazon-s3-bucket
        const result = new Subject<any>();

        this.S3.getObject({ Bucket: environment.awsBucket, Key: image.path }, (error, data) => {
            if (error) { result.error(error); return; }

            result.next(new Blob([data.Body.buffer]));
            result.complete();
        });

        return result;
    }

    public getPreviewImage(image: App.Image, flip: boolean, threshold: number, rect: Array<number>): Observable<Blob> {
        return this.auth.POST(`/previewCurve`, {}, { Accept: 'application/octet-stream' }, {
            image_url: image.url,
            flip: flip,
            thresh: threshold,
            rect: rect,
            color: '#009aff'
        }).pipe(map(response => {
            return response.body;
        }));
    }

    public matchCurve(image: App.Image, flip: boolean, threshold: number, rect: Array<number>): Observable<App.MatchResult> {
        return this.auth.POST(`/matchCurve`, {}, {}, {
            image_url: image.url,
            flip: flip,
            thresh: threshold,
            rect: rect,
        }).pipe(map(response => App.MatchResult.fromJSON(response.body)));
    }

    public storeCurve(image: App.Image, name: string, curve: Array<number>): Observable<void> {
        return this.auth.POST(`/storeCurve`, {}, {
            Accept: 'text/plain',
        }, {
            sourceimage: image.url,
            name: name,
            curve: curve,
        }).pipe(map(() => {}));
    }

    public getAllStoredCurves(): Observable<Array<App.Match>> {
        return this.auth.GET(`/allRecords`, {}).pipe(map(response => {
            return response.body.map(o => {
                const match: App.Match = new App.Match();
                match.name = o[0];
                match.url = o[2];
                return match;
            });
        }));
    }

    public clearCurvesForVideo(video: App.Video): Observable<void> {
        return this.auth.POST(`/clearVideoLabels`, {}, {}, {
            s3_url: video.url,
        }).pipe(map(() => {}));
    }
}

export module App {
    export enum VideoState {
        UNKNOWN,
        PROCESSING,
        ERROR,
        COMPLETE,
    }

    export module VideoState {
        export function fromString(value: string): VideoState {
            switch (value) {
                case 'queued':
                case 'started':
                case 'running':
                case 'deferred': return VideoState.PROCESSING;
                case 'failed': return VideoState.ERROR;
                case 'finished': return VideoState.COMPLETE;
                default: return VideoState.UNKNOWN;
            }
        }
    }


    export class Video {
        public id: string;
        public path: string;
        public url: string;
        public state: VideoState = VideoState.UNKNOWN;
        public images: Array<Image> = [];

        public static fromJSON(json: any): Video {
            const result = new Video();
            Object.assign(result, json);
            result.url = `s3://${environment.awsBucket}/${result.path}`;
            return result;
        }
    }


    export class Image {
        public path: string;
        public url: string;

        public static fromJSON(json: any): Image {
            const result = new Image();
            Object.assign(result, json);
            result.url = `s3://${environment.awsBucket}/${result.path}`;
            return result;
        }
    }

    export class MatchResult {
        public curve: Array<number>;
        public matches: Array<Match>;

        public static fromJSON(json: any): MatchResult {
            const result = new MatchResult();
            Object.assign(result, json);
            result.matches = !Array.isArray(json.matches) ? [] : json.matches.map(o => Match.fromJSON(o));
            return result;
        }
    }

    export class Match {
        public name: string;
        public url: string;
        public image: Image;

        public static fromJSON(json: Array<string>): Match {
            const result = new Match();
            result.name = json.length > 0 ? json[0] : undefined;
            result.url = json.length > 1 ? json[1] : undefined;
            return result;
        }
    }
}
