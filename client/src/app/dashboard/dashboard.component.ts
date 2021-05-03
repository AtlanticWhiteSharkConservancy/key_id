import { Component } from '@angular/core';
import { App } from '@services/app/app.api';
import { VideoManager } from '@services/app/managers/video.manager';
import { NotificationsService } from 'angular2-notifications';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
    public processed: Array<App.Video> = [];
    public processing: Array<App.Video> = [];
    public unprocessed: Array<App.Video> = [];

    constructor(private notifications: NotificationsService) {}

    public ngOnInit() {
        this.updateSets();
    }

    private updateSets() {
        this.processed = VideoManager.sharedInstance.videos.filter(o => o.state === App.VideoState.COMPLETE);
        this.processing = VideoManager.sharedInstance.videos.filter(o => o.state === App.VideoState.PROCESSING);
        this.unprocessed = VideoManager.sharedInstance.videos.filter(o => o.state === App.VideoState.UNKNOWN || o.state === App.VideoState.ERROR);
    }

    public disabled: { [key: string]: boolean } = {};

    public onProcess(video: App.Video) {
        this.disabled[video.id] = true;
        VideoManager.sharedInstance.processVideo(video).pipe(finalize(() => {
            this.disabled[video.id] = false;
        })).subscribe(() => {
            this.updateSets();
            this.notifications.success('Success', 'Video submitted for processing.');
        }, error => {
            this.notifications.error('Error', 'Failed to submit video for processing.');
        });
    }

    public match(video: App.Video): App.Match {
        return VideoManager.sharedInstance.findSingleMatchForVideo(video);
    }
}
