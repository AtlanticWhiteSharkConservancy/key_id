import { Component, ElementRef, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { App } from '@services/app/app.api';
import { AppService } from '@services/app/app.service';
import { VideoManager } from '@services/app/managers/video.manager';
import { NotificationsService } from 'angular2-notifications';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

@Component({
    selector: 'app-image-cropper',
    templateUrl: './image-cropper.component.html',
    styleUrls: ['./image-cropper.component.scss']
})
export class ImageCropperComponent {
    @ViewChild('container', { static: true })
    public container: ElementRef;

    public flip: boolean = false;
    public threshold: number = 128;
    public alpha: number = 0.65;
    public red: number = 0.299;
    public green: number = 0.587;
    public blue: number = 0.114;
    public ww: number = 255;
    public wl: number = 128;
    
    private path: string;
    private image: App.Image;
    private imageElement: HTMLImageElement;
    private canvas: HTMLCanvasElement;
    private imageData1: ImageData;
    private imageData2: ImageData;

    private subscriptions: Array<Subscription> = [];

    constructor(
        private route: ActivatedRoute, 
        private sanitizer: DomSanitizer, 
        private app: AppService,
        private notifications: NotificationsService) {}

    public ngOnInit() {
        this.subscriptions.push(this.route.queryParams.subscribe(() => {
            this.path = this.route.snapshot.queryParams.path;
            this.refresh();
        }));
    }

    public ngOnDestroy() {
        this.subscriptions.forEach(o => o.unsubscribe());
    }

    private refresh() {
        this.image = undefined;
        this.imageElement = undefined;
        if (this.canvas) {
            this.canvas.parentElement.removeChild(this.canvas);
            this.canvas = undefined;
        }
        this.imageData1 = undefined;
        this.imageData2 = undefined;

        VideoManager.sharedInstance.videos.forEach(video => {
            this.image = this.image || video.images.find(o => o.path === this.path);
        });

        if (!this.image) { return; }

        this.app.API.getImageData(this.image).subscribe(blob => {
            let imageElement = new Image();
            imageElement.onload = () => {
                this.imageElement = imageElement;
                const canvas: HTMLCanvasElement = document.createElement('canvas');
                canvas.width = imageElement.width;
                canvas.height = imageElement.height;
                this.container.nativeElement.appendChild(canvas);
                this.canvas = canvas;
                
                const context = this.canvas.getContext('2d');
                context.drawImage(this.imageElement, 0, 0);
                this.imageData1 = context.getImageData(0, 0, this.imageElement.width, this.imageElement.height);
                this.imageData2 = context.getImageData(0, 0, this.imageElement.width, this.imageElement.height);

                this.updateImage();
            }
            imageElement.src = URL.createObjectURL(blob);
        });
    }

    private updating: boolean = false;
    private needsUpdate: boolean = false;

    public updateImage() {
        if (!this.canvas || !this.imageData1 || !this.imageData2) { return; }

        this.needsUpdate = true;
        if (this.updating) { return; }

        this.needsUpdate = false;
        this.updating = true;

        this.index = 0;
        this.applyFilters();

        this.grayscaleFilter(this.imageData1.data, this.imageData2.data);
        this.canvas.getContext('2d').putImageData(this.imageData2, 0, 0);
    }

    private index = 0;

    private applyFilters() {
        const complete = this.grayscaleFilter(this.imageData1.data, this.imageData2.data);
        if (complete) {
            this.canvas.getContext('2d').putImageData(this.imageData2, 0, 0);
            setTimeout(() => {
                this.updating = false;
                if (this.needsUpdate) { this.updateImage(); }
            });
        } else {
            setTimeout(() => this.applyFilters());
        }
    }

    private grayscaleFilter(input: Uint8ClampedArray, output: Uint8ClampedArray): boolean {
        // mimmick opencv https://stackoverflow.com/a/19181932/1684376
        const alpha = this.alpha, nalpha = 1 - alpha;

        const total = this.red + this.green + this.blue;
        const rp = this.red / total;
        const gp = this.green / total;
        const bp = this.blue / total;

        const width = this.imageElement.width;
        const width_4 = width * 4;

        for (let i = this.index; i < input.length; i += 4, this.index = i) {
            const r = input[i], g = input[i + 1], b = input[i + 2];
            const l = (rp * r) + (gp * g) + (bp * b);
            const n = l; // ((l - this.wl) * (this.ww / 255)) + this.wl;
            const v = (n < (255 - this.threshold)) ? 0 : 255;

            const row = Math.floor(i / width_4);
            const col = this.flip ? ((width_4 - 4) - (i % width_4)) : (i % width_4);
            const d = row * width_4 + col;
            
            output[d] = (alpha * n) + (nalpha * v);
            output[d + 1] = (alpha * n) + (nalpha * v);
            output[d + 2] = (alpha * n) + (nalpha * v);
        }

        return this.index >= input.length;
    }

    public showImageRect: boolean = false;
    public top: number = 0;
    public left: number = 0;
    public width: number = 0;
    public height: number = 0;

    private mouseIsDown: boolean = false;

    public onMousedown($event) {
        this.mouseIsDown = true;
        this.showImageRect = true;
        this.preview = undefined;
        this.matches = undefined;

        const width = this.container.nativeElement.offsetWidth;
        const height = this.container.nativeElement.offsetHeight;
        this.top = ($event.offsetY / height) * 100;
        this.left = ($event.offsetX / width) * 100;
        this.width = 0;
        this.height = 0;
    }

    public onMouseup($event) {
        this.onMousemove($event);
        this.mouseIsDown = false;

        if (this.width < 1 && this.height < 1) {
            this.showImageRect = false;
        }
    }

    public onMousemove($event) {
        if (!this.mouseIsDown) { return; }

        const width = this.container.nativeElement.offsetWidth;
        const height = this.container.nativeElement.offsetHeight;
        const top = ($event.offsetY / height) * 100;
        const left = ($event.offsetX / width) * 100;
        this.width = left - this.left;
        this.height = top - this.top;
    }

    private imageCache: { [key: string]: BehaviorSubject<SafeResourceUrl> } = {};

    public src(image: App.Image): Observable<SafeResourceUrl> {
        if (this.imageCache[image.path]) { return this.imageCache[image.path]; }

        const subject = new BehaviorSubject<string>(undefined);
        this.imageCache[image.path] = subject

        this.app.API.getImageData(image).pipe(map(blob => {
            return this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
        })).subscribe(subject);

        return subject;
    }

    public loading: boolean = false;
    public preview: SafeResourceUrl;

    public onSubmitPreview() {
        const width = this.imageElement.width;
        const height = this.imageElement.height;

        const rect: Array<number> = [
            Math.round(this.left * width / 100),
            Math.round(this.top * height / 100),
            Math.round((this.left + this.width) * width / 100),
            Math.round((this.top + this.height) * height / 100),
        ]; 

        this.loading = true;
        this.app.API.getPreviewImage(this.image, this.flip, this.threshold, rect).pipe(finalize(() => {
            this.loading = false;
        })).subscribe(blob => {
            this.preview = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
        }, error => {
            this.notifications.error('Error', 'Failed to find curve.');
        });
    }

    public onMatchCurve() {
        const width = this.imageElement.width;
        const height = this.imageElement.height;

        const rect: Array<number> = [
            Math.round(this.left * width / 100),
            Math.round(this.top * height / 100),
            Math.round((this.left + this.width) * width / 100),
            Math.round((this.top + this.height) * height / 100),
        ]; 

        this.loading = true;
        this.app.API.matchCurve(this.image, this.flip, this.threshold, rect).pipe(finalize(() => {
            this.loading = false;
        })).subscribe(result => {
            result.matches.forEach(o => { o.image = VideoManager.sharedInstance.findMatchingImage(o.url); });
            result.matches = result.matches.filter(o => o.image);

            this.matches = result;
        }, error => {
            this.notifications.error('Error', 'Something went wrong.');
        });
    }

    public name: string;
    public matches: App.MatchResult;

    public onCreateNew() {
        this.loading = true;
        VideoManager.sharedInstance.saveMatch(this.image, this.name, this.matches.curve).pipe(finalize(() => {
            this.loading = false;
        })).subscribe(() => {
            this.showImageRect = false;
            this.preview = undefined;
            this.matches = undefined;
            this.notifications.success('Success', 'Shark has been successfully saved.');
        }, error => {
            this.notifications.error('Error', 'Failed to save shark.');
        });
    }

    public onSelectMatch(match: App.Match) {
        this.loading = true;
        VideoManager.sharedInstance.saveMatch(this.image, match.name, this.matches.curve).pipe(finalize(() => {
            this.loading = false;
        })).subscribe(() => {
            this.showImageRect = false;
            this.preview = undefined;
            this.matches = undefined;
            this.notifications.success('Success', 'Shark has been successfully saved.');
        }, error => {
            this.notifications.error('Error', 'Failed to save shark.');
        });
    }
}
