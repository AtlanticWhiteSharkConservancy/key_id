import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';

export enum AsyncProcessorResult { SUCCESS, FAILED, FAILED_WILL_RETRY, CANCELED }

type ProcessFunction = (key: any) => Observable<any>;
type ProgressFunction = (key: any, data: any, result: AsyncProcessorResult) => void;
type CompleteFunction = (result: AsyncProcessorResult) => void;

export class AsyncProcessor {
    public static RETRY_NO_LIMIT: number = -1;

    public enabled: boolean = true;
    public working: boolean = false;
    public maxRetryCount: number = 0;
    public retryDelay: number = 5.0; // seconds

    public process: ProcessFunction = undefined;
    public progress: ProgressFunction = undefined;
    public complete: CompleteFunction = undefined;

    private processing: any[] = undefined;
    private pending: any[] = undefined;
    private retryCount: number = 0;
    private pointer: number = 0;
    private result: AsyncProcessorResult = AsyncProcessorResult.SUCCESS;

    public processKeys(keys: any[]) {
        if (keys === undefined || !this.enabled) { return; }

        this.pending = keys;
        if (this.processing !== undefined) { return; }

        this.working = true;
        this.processing = this.pending;
        this.pending = undefined;

        this.next();
    }

    private next() {
        if (this.processing.length == 0 || this.processing.length <= this.pointer) {
            let result = this.result;
            this.result = AsyncProcessorResult.SUCCESS;
            this.pointer = 0;
            this.processing = undefined;
            this.working = false;

            if (this.complete) { this.complete(result); }
            this.processKeys(this.pending);

            return;
        }

        if (this.process) {
            this.process(this.processing[this.pointer]).pipe(first())
                .subscribe(result => {
                    this.completion(result, true);
                }, error => {
                    this.completion(undefined, false);
                });
        } else {
            this.completion(undefined, true);
        }
    }

    private completion(data: any, success: boolean) {
        if (this.result == AsyncProcessorResult.CANCELED) {
            this.next();
        } else if (success) {
            if (this.progress) { this.progress(this.processing[this.pointer], data, AsyncProcessorResult.SUCCESS); }

            this.retryCount = 0;
            this.pointer++;
            this.next();
        } else if (this.maxRetryCount == AsyncProcessor.RETRY_NO_LIMIT || this.retryCount < this.maxRetryCount) {
            if (this.progress) { this.progress(this.processing[this.pointer], undefined, AsyncProcessorResult.FAILED_WILL_RETRY); }

            this.retryCount++;
            setTimeout(() => { this.next(); }, this.retryDelay * 1000);
        } else {
            if (this.progress) { this.progress(this.processing[this.pointer], undefined, AsyncProcessorResult.FAILED); }

            this.result = AsyncProcessorResult.FAILED;
            this.retryCount = 0;
            this.pointer++;
            this.next();
        }
    }

    public cancel() {
        if (!this.processing || this.processing.length == 0) { return; }

        this.processing = [];
        this.result = AsyncProcessorResult.CANCELED;
    }
}
