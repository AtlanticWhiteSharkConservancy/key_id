import { AppAPI, App } from '../app.api';
import { forkJoin, Observable, of } from 'rxjs';
import { Manager } from '@classes/manager';
import { tap } from 'rxjs/operators';

export class VideoManager extends Manager {
    public static sharedInstance: VideoManager;

    public videos: Array<App.Video> = [];
    public matches: Array<App.Match> = [];

    constructor(private api: AppAPI) {
        super();
        VideoManager.sharedInstance = this;
    }

    protected fetchData(): Observable<any> {
        return forkJoin([
            this.api.getAllVideos(),
            this.api.getAllJobStatuses(),
            this.api.getAllStoredCurves(),
        ]);
    }

    protected setData(responses: any) {
        this.videos = responses[0] || [];

        const jobStatuses = responses[1];
        Object.keys(jobStatuses).forEach(key => {
            const url = key.split(' ')[0];
            const video = this.videos.find(o => o.url === url);
            const state = App.VideoState.fromString(jobStatuses[key]);
            if (video && state !== App.VideoState.UNKNOWN) {
                video.state = state;
            }
        });

        const matches: Array<App.Match> = responses[2];
        matches.forEach(o => { o.image = VideoManager.sharedInstance.findMatchingImage(o.url); });
        this.matches = matches.filter(o => o.image);
    }

    public reset() {
        super.reset();
        this.videos = [];
        this.matches = [];
    }

    public processVideo(video: App.Video): Observable<void> {
        return this.api.processVideo(video).pipe(tap(() => {
            video.state = App.VideoState.PROCESSING;
        }));
    }

    public findSingleMatchForVideo(video: App.Video): App.Match {
        return this.matches.find(match => {
            const prefix = match.url.split('/').slice(0, -1).join('/');
            return video.url.startsWith(prefix);
        });
    }

    public findAllMatchesForVideo(video: App.Video): Array<App.Match> {
        return this.matches.filter(match => {
            const prefix = match.url.split('/').slice(0, -1).join('/');
            return video.url.startsWith(prefix);
        });
    }

    public saveMatch(image: App.Image, name: string, curve: Array<number>): Observable<void> {
        return this.api.storeCurve(image, name, curve).pipe(tap(() => {
            let match: App.Match = new App.Match();
            match.name = name;
            match.url = image.url;
            match.image = image;
            this.matches.push(match);
        }));
    }

    public clearMatchesForVideo(video: App.Video): Observable<void> {
        return this.api.clearCurvesForVideo(video).pipe(tap(() => {
            this.matches = this.matches.filter(match => {
                const prefix = match.url.split('/').slice(0, -1).join('/');
                return !video.url.startsWith(prefix);
            });
        }));
    }

    public findMatchingImage(url: string): App.Image {
        const prefix = url.split('/').slice(0, -1).join('/');

        let match: App.Image;
        this.videos.forEach(video => {
            if (match || !video.url.startsWith(prefix)) { return; }
            match = video.images.find(image => image.url === url);
        }); 

        return match;
    }

}
