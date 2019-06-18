//
// Copyright (c) 2017 Vitus Lehner. All rights reserved.
// Licensed under the MIT License. See LICENSE file in
// the project root for full license information.
//

import axios, { AxiosPromise, AxiosRequestConfig } from "axios";
import { constants } from "./constants";
import * as qs from "qs";
import axiosCookieJarSupport from "axios-cookiejar-support";
import tough = require("tough-cookie");

class MyStudyClient {
    private config: AxiosRequestConfig;

    constructor() {
        axiosCookieJarSupport(axios);

        const cookieJar = new tough.CookieJar();
        this.config = {
            jar: cookieJar,
            withCredentials: true
        };
    }

    public getHomepage(): AxiosPromise {
        return axios.get(MyStudyClient.buildUrl(constants.remote.endpoints.homepage), this.config);
    }

    public postLogin(username: string, password: string): AxiosPromise {
        const data = {
            un: username,
            pw: password
        };
        const formData = qs.stringify(data);
        return axios.post(MyStudyClient.buildUrl(constants.remote.endpoints.login), formData, {
            ...this.config,
            maxRedirects: 0,
            validateStatus: function(status) {
                return status < 400;
            }
        });
    }

    public getDashboard(): AxiosPromise {
        return axios.get(MyStudyClient.buildUrl(constants.remote.endpoints.dashboard), this.config);
    }

    public getEnrollments(): AxiosPromise {
        return axios.post(MyStudyClient.buildUrl(constants.remote.endpoints.enrollments), undefined, {
            ...this.config,
            headers: { "X-Requested-With": "XMLHttpRequest" }
        });
    }

    public getEnrollmentFileManager(id: string): AxiosPromise {
        return axios.get(MyStudyClient.buildUrl(constants.remote.endpoints.fileManager) + id, this.config);
    }

    public getFileManagerDirectory(itemId: string): AxiosPromise {
        const data = {
            entity_id: itemId
        };
        const formData = qs.stringify(data);
        return axios.post(MyStudyClient.buildUrl(constants.remote.endpoints.fileManagerGetDirectory), formData, {
            ...this.config,
            headers: { "X-Requested-With": "XMLHttpRequest" }
        });
    }

    public getDownload(id: string): AxiosPromise {
        return axios.get(MyStudyClient.buildUrl(constants.remote.endpoints.download) + id, {
            ...this.config,
            responseType: "stream"
        });
    }

    private static buildUrl(endpoint: string): string {
        return constants.remote.baseUrl + endpoint;
    }
}

export const myStudyClient = new MyStudyClient();
