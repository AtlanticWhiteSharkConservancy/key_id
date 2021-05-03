import { AsyncProcessor } from './async-processor';
import { AsyncProcessorResult } from './async-processor';
import { Observable } from 'rxjs';

type SearchFunction<T> = () => Observable<T>;
type CallbackFunction<T> = (data: T) => void;

export class AsyncDataSource<T> {
    public callback: CallbackFunction<T> = undefined;
    public processor = new AsyncProcessor();

    constructor(private search: SearchFunction<T>) {
        this.processor.maxRetryCount = AsyncProcessor.RETRY_NO_LIMIT;
        this.processor.process = (key) => { return search(); };
        this.processor.progress = (key, data, result) => {
            if (!this.callback) { return; }
            if (result === AsyncProcessorResult.SUCCESS) {
                this.callback(data);
            } else if (result === AsyncProcessorResult.FAILED) {
                // this will only be called if the source's creator sets the
                // maxRetryCount to some finite number, at which point, they are
                // expecting to get an 'undefined' result on failure.
                this.callback(undefined);
            }
        };
    }

    public refresh() { this.processor.processKeys([""]); }
    public cancel() { this.processor.cancel(); }
}
