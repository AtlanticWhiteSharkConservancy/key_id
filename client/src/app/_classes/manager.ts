import { AsyncDataSource } from './async-data-source';
import { Observable } from 'rxjs';
import { of as ObservableOf } from 'rxjs';
import { Subject } from 'rxjs';

const NOT_ENABLED = { id: 'not-enabled' };

export abstract class Manager {
    public enabled: boolean = false;

    public refreshInterval: number = 300000; // milliseconds
    protected lastRefreshTime: number = 0;

    public update$: Subject<void> = new Subject<void>();
    private currentSubject: Subject<boolean>;
    private nextSubject: Subject<boolean>;

    private source: AsyncDataSource<void>;

    public refresh(force: boolean = false): Observable<boolean> {
        if (!this.enabled) { return ObservableOf(false); }

        if (!force) {
            if ((Date.now() - this.lastRefreshTime) < this.refreshInterval) { return ObservableOf(false); }
            if (this.currentSubject) { return this.currentSubject; }
        }

        this.nextSubject = this.nextSubject || new Subject<boolean>();
        if (this.currentSubject) { return this.nextSubject; }

        this.currentSubject = this.nextSubject || new Subject<boolean>();
        this.nextSubject = undefined;

        this.source = new AsyncDataSource<any>(() => {
            if (!this.enabled) { return ObservableOf(NOT_ENABLED); }
            return this.fetchData();
        });
        this.source.callback = (data: any) => {
            this.source.callback = undefined;
            this.source = undefined;

            if (data === NOT_ENABLED) {
                this.currentSubject.error(data);
                this.currentSubject = undefined;
                return;
            }

            this.setData(data);
            this.lastRefreshTime = Date.now();
            this.currentSubject.next(true);
            this.currentSubject.complete();
            this.currentSubject = undefined;
            this.update$.next();

            if (this.nextSubject) { this.refresh(true); }
        };
        this.source.refresh();

        return this.currentSubject;
    }

    public cancel() {
        if (!this.source || !this.currentSubject) { return; }

        this.source.callback = undefined;
        this.source = undefined;

        this.currentSubject.next(false);
        this.currentSubject.complete();
        this.currentSubject = undefined;

        if (this.nextSubject) {
            this.nextSubject.next(false);
            this.nextSubject.complete();
            this.nextSubject = undefined;
        }
    }

    public reset() {
        this.lastRefreshTime = 0;
    }

    protected abstract fetchData(): Observable<any>;
    protected abstract setData(data: any);
}
