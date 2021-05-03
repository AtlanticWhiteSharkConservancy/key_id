import { AppAPI } from './app.api';
import { AuthService } from '../auth.service';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { VideoManager } from './managers/video.manager';
import { Manager } from '@classes/manager';

@Injectable()
export class AppService {
    public API: AppAPI;

    public videoManager: VideoManager;
    private allManagers: Array<Manager> = [];

    constructor(public auth: AuthService) {
        this.API = new AppAPI(auth);
        this.videoManager = new VideoManager(this.API);
        this.allManagers = [this.videoManager];
    }

    public start(): Observable<any> {
        this.allManagers.forEach(o => o.enabled = true);
        
        return forkJoin(this.allManagers.map(o => o.refresh()));
    }

    public stop() {
        this.allManagers.forEach(manager => {
            manager.enabled = false;
            manager.cancel();
            manager.reset();
        });
    }
}
