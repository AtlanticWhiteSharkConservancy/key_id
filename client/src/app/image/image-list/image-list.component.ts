import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { App } from '@services/app/app.api';
import { AppService } from '@services/app/app.service';
import { VideoManager } from '@services/app/managers/video.manager';
import { NotificationsService } from 'angular2-notifications';
import { forkJoin, Subscription } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

@Component({
    selector: 'app-image-list',
    templateUrl: './image-list.component.html',
    styleUrls: ['./image-list.component.scss']
})
export class ImageListComponent {
    public path: string;
    public video: App.Video;
    public images: Array<App.Image> = [];
    public matches: Array<App.Match> = [];
    public loading: boolean = false;

    private subscriptions: Array<Subscription> = [];

    constructor(
        private route: ActivatedRoute, 
        private sanitizer: DomSanitizer, 
        private app: AppService,
        private notifications: NotificationsService
    ) {}

    public ngOnInit() {
        this.subscriptions.push(this.route.queryParams.subscribe(() => {
            this.path = this.route.snapshot.queryParams.path;
            this.refresh();
        }));
    }

    public ngOnDestroy() {
        this.subscriptions.forEach(o => o.unsubscribe());
        this.destroyed = true;
    }

    private refresh() {
        this.video = VideoManager.sharedInstance.videos.find(o => o.path === this.path);
        this.images = [];
        this.matches = VideoManager.sharedInstance.findAllMatchesForVideo(this.video);

        this.index = 0;
        this.imageCache = {};
        this.loadMatches();
        this.loadImages();
    }

    private loadMatches() {
        forkJoin(this.matches.map(match => {
            return this.app.API.getImageData(match.image).pipe(map(blob => {
                const url: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
                this.imageCache[match.image.path] = url;
            }));
        })).subscribe(() => {});
    }

    private destroyed: boolean = false;
    private index = 0;
    private loadImages() {
        const images = this.video.images.slice(this.index, this.index + 10);
        if (!images.length || this.destroyed) { return; }

        this.index += 10;
        forkJoin(images.map(image => {
            return this.app.API.getImageData(image).pipe(map(blob => {
                const url: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
                this.imageCache[image.path] = url;
            }));
        })).subscribe(() => {
            this.images = this.images.concat(images);
            setTimeout(() => { this.loadImages(); }, 250);
        });
    }

    private imageCache: { [key: string]: SafeResourceUrl } = {};

    public src(image: App.Image): SafeResourceUrl {
        return this.imageCache[image.path]; 
    }

    public onClearMatch() {
        this.loading = true;
        VideoManager.sharedInstance.clearMatchesForVideo(this.video).pipe(finalize(() => {
            this.loading = false;
        })).subscribe(() => {
            this.matches = [];
        }, error => {
            this.notifications.error('Error', 'Failed to match.');
        })
    }
}
