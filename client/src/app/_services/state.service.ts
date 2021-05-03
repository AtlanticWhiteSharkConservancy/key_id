import { Router } from "@angular/router";
import { AppService } from './app/app.service';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from "rxjs";
import { forkJoin } from "rxjs";
import { AsyncDataSource } from "@classes/async-data-source";

@Injectable()
export class StateService {
    public loading$: BehaviorSubject<boolean> = new BehaviorSubject(true);

    constructor(private app: AppService, private router: Router) {
        this.updateDataSource();
    }

    private dataSource: AsyncDataSource<Array<any>> = undefined;

    private updateDataSource() {
        if (this.dataSource) { return; }

        // the user is newly logged in.  fetch all the local data needed to
        // run the application.
        this.loading$.next(true);
        this.dataSource = new AsyncDataSource<Array<any>>(() => {
            return forkJoin([
                this.app.start(),
            ]);
        });
        this.dataSource.callback = (result) => {
            if (result) {
                this.loading$.next(false);
            } else {
                // TODO display error message
            }
        }
        this.dataSource.processor.maxRetryCount = 3;
        this.dataSource.refresh();
    }
}
