import { Injectable } from "@angular/core";
import { environment } from "@environments/environment";
import { BehaviorSubject, Observable, Subject, throwError } from "rxjs";
import { timeout } from "rxjs/operators";
import { HttpClient, HttpResponse } from '@angular/common/http';

const TIMEOUT_PARAM = 'TIMEOUT_MS';
const DEFAULT_TIMEOUT_MS = 60 * 5 * 1000; // 5 min

interface PendingRequest {
    method: string;
    path: string;
    params: { [key: string]: string | Array<string> };
    headers: { [key: string]: string };
    data?: any;
    compress: boolean;
}

@Injectable()
export class AuthService {
    public loggedIn$: BehaviorSubject<boolean> = new BehaviorSubject(true);

    constructor(private http: HttpClient) {}

    private request(method: string, path: string, params_: { [key: string]: string | Array<string> }, headers_: { [key: string]: string }, data: any, compress: boolean): Observable<HttpResponse<any>> {
        let headers: { [key: string]: string | Array<string> } = { ...(headers_ || {}) };

        if (!!data && !headers['Content-Type']) { headers['Content-Type'] = 'application/json'; }
        if (!headers['Accept']) { headers['Accept'] = 'application/json'; }

        let responseType: 'blob' | 'json' | 'text' =
            headers['Accept'] === 'application/octet-stream' ? 'blob' : headers['Accept'] === 'application/json' ? 'json' : 'text';

        let timeoutMs = !!params_[TIMEOUT_PARAM] ? +params_[TIMEOUT_PARAM] : DEFAULT_TIMEOUT_MS;

        // Workaround https://github.com/angular/angular/issues/11058
        let params: { [key: string]: string | Array<string> } = { ...(params_ || {}) };
        for (let key in params) {
            if (params[key] === undefined) {
                delete params[key];
            } else {
                let array: Array<any> = Array.isArray(params[key]) ? params[key] as Array<string> : [params[key] as string];
                array = array.map(o => {
                    if (!((o as any) instanceof Date) || !o.getTime()) { return o; }
                    return o.toISOString(); // serialize dates in a specific way
                }).filter(o => o !== undefined);
                if (!array.length) {
                    delete params[key];
                } else {
                    params[key] = array.length === 1 ? array[0] : array;
                }
            }
        }
        delete params[TIMEOUT_PARAM];

        let url = this.baseUrl() + path;

        let subject = new Subject<HttpResponse<any>>();
        this.http.request(method, url, {
            body: data,
            headers: headers,
            params: params,
            responseType: responseType,
            observe: 'response',
        }).pipe(timeout(timeoutMs)).subscribe(response => {
            subject.next(response);
            subject.complete();
        }, response => {
            this.fail(response, { 'method': method, 'path': path, 'params': params_, 'headers': headers_, 'data': data, 'compress': compress }).subscribe(subject);
        });

        return subject;
    }

    public baseUrl(): string {
        return environment.apiUrl;
    }

    public GET(path: string, params: { [key: string]: string | Array<string> }, headers: { [key: string]: string } = {}, data: any = undefined, compress: boolean = false): Observable<HttpResponse<any>> {
        return this.request('GET', path, params, headers, data, compress);
    }

    public POST(path: string, params: { [key: string]: string | Array<string> }, headers: { [key: string]: string } = {}, data: any = undefined, compress: boolean = false): Observable<HttpResponse<any>> {
        return this.request('POST', path, params, headers, data, compress);
    }

    public PUT(path: string, params: { [key: string]: string | Array<string> }, headers: { [key: string]: string } = {}, data: any = undefined, compress: boolean = false): Observable<HttpResponse<any>> {
        return this.request('PUT', path, params, headers, data, compress);
    }

    public PATCH(path: string, params: { [key: string]: string | Array<string> }, headers: { [key: string]: string } = {}, data: any = undefined, compress: boolean = false): Observable<HttpResponse<any>> {
        return this.request('PATCH', path, params, headers, data, compress);
    }

    public DELETE(path: string, params: { [key: string]: string | Array<string> }, headers: { [key: string]: string } = {}, data: any = undefined, compress: boolean = false): Observable<HttpResponse<any>> {
        return this.request('DELETE', path, params, headers, data, compress);
    }

    private fail(response: HttpResponse<any>, request: PendingRequest): Observable<HttpResponse<any>> {
        return throwError(response);
    }
}
