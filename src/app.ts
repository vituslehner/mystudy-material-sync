//
// Copyright (c) 2017 Vitus Lehner. All rights reserved.
// Licensed under the MIT License. See LICENSE file in
// the project root for full license information.
//

import { config } from "dotenv";

import { myStudyClient } from "./client";
import * as cheerio from "cheerio";
import { AxiosResponse } from "axios";
import { DownloadJob, Enrollment, Item, ITEM_TYPE } from "./models";
import { jsonToItem, itemPathToString, sanitizeFileSystemName } from "./utils";
import * as os from "os";
import { constants } from "./constants";
import * as fs from "fs";

class App {
    async run() {
        const userDirectory = os.homedir();
        const downloadBasePath = userDirectory + "/" + constants.local.downloadDirectory;

        console.debug("-- User directory:", os.homedir());
        console.debug("-- Download directory:", downloadBasePath);

        const homepageResponse: AxiosResponse = await myStudyClient.getHomepage();

        const loginResponse: AxiosResponse = await myStudyClient.postLogin(
            process.env.MYSTUDY_USERNAME,
            process.env.MYSTUDY_PASSWORD
        );
        App.checkLoginSuccess(loginResponse);
        console.info("\n-- Login successful!");

        const dashboardResponse: AxiosResponse = await myStudyClient.getDashboard();
        const dashboardDom: CheerioStatic = cheerio.load(dashboardResponse.data);

        const semester = App.extractSemesterFromDashboard(dashboardDom);
        const semesterBasePath = downloadBasePath + "/" + sanitizeFileSystemName(semester);
        console.info("-- Semester:", semester);
        console.info("-- Semester directory:", semesterBasePath);

        const enrollmentsResponse: AxiosResponse = await myStudyClient.getEnrollments();
        const enrollments = App.validateAndExtractEnrollments(enrollmentsResponse.data);
        console.info("\nEnrollments:");
        enrollments.forEach(e => console.info(" ▸", e.name, e.veranstaltung_id));

        const items = await Promise.all(
            enrollments.map(async e => {
                const enrollmentResponse: AxiosResponse = await myStudyClient.getEnrollmentFileManager(
                    e.veranstaltung_id
                );
                const enrollmentDom: CheerioStatic = cheerio.load(enrollmentResponse.data);

                const lectureItem = App.validateAndExtractLectureItem(enrollmentDom);
                return await App.loadFileTreeRecursively(lectureItem);
                // printItemRecursively(lectureTree);
            })
        );

        App.ensureLocalDirectories(downloadBasePath, semesterBasePath);

        const jobs = items
            .map(i => App.syncItemRecursively(i, [], semesterBasePath))
            .reduce((previousJobs, currentJobs) => {
                return previousJobs.concat(currentJobs);
            }, []);

        await App.processDownloadJobs(jobs);
    }

    private static checkLoginSuccess(loginResponse: AxiosResponse) {
        if (!loginResponse.headers.location || !loginResponse.headers.location.endsWith("/dashboard/default")) {
            throw new Error("Login failed: Bad credentials");
        }
    }

    private static extractSemesterFromDashboard(dashboardDom: CheerioStatic) {
        const userInfoElements = dashboardDom("#user-settings-menu .user-info-close span");
        return userInfoElements
            .last()
            .text()
            .replace("|", "")
            .trim()
            .replace(" ", "-");
    }

    private static validateAndExtractEnrollments(enrollmentsData: any) {
        if (enrollmentsData.liste && enrollmentsData.liste.length > 0) {
            return enrollmentsData.liste as Enrollment[];
        }
        throw new Error("Can not read enrollments: Invalid format");
    }

    private static validateAndExtractLectureItem(fileManagerDom: CheerioStatic) {
        const fileManagerString = fileManagerDom("div#dateimanager").get(0).attribs.dateimanager;

        const json = JSON.parse(fileManagerString);
        const items = json.root_directories.map(jsonToItem);

        if (items.length !== 1) {
            throw new Error("Failed to read lecture item. Lecture count: " + items.length);
        }

        return items[0] as Item;
    }

    private static async loadFileTreeRecursively(item: Item): Promise<Item> {
        if (item.type === ITEM_TYPE.file || item.isProtected) {
            return Promise.resolve(item);
        }

        const itemResponse = await myStudyClient.getFileManagerDirectory(item.id);
        const refreshedItem = jsonToItem(itemResponse.data);
        const refreshedChildren = await Promise.all(
            refreshedItem.children.map(async i => {
                return await App.loadFileTreeRecursively(i);
            })
        );

        return Promise.resolve({
            ...refreshedItem,
            children: refreshedChildren
        });
    }

    private static syncItemRecursively(item: Item, path: Item[], basePath: string): DownloadJob[] {
        const itemPath = basePath + itemPathToString(path) + "/" + item.sanitizedName;
        const jobs = [];

        if (fs.existsSync(itemPath)) {
            console.debug("-- Already exists:", itemPath);
        } else {
            console.info("-- New:", itemPath);

            if (item.type === ITEM_TYPE.lecture && item.children.length === 0) {
                console.debug("-- Skipping because lecture empty:", item.name);
            } else if (item.type === ITEM_TYPE.lecture || item.type === ITEM_TYPE.directory) {
                console.info("-- Creating directory for", item.name);
                fs.mkdirSync(itemPath);
                console.info("-- Finished creating directory for", item.name);
            } else if (item.type === ITEM_TYPE.file) {
                jobs.push({ item: item, downloadFilePath: itemPath } as DownloadJob);
            }
        }

        return item.children
            .map(i => this.syncItemRecursively(i, path.concat([item]), basePath))
            .reduce((previousJobs, currentJobs) => {
                return previousJobs.concat(currentJobs);
            }, jobs);
    }

    private static ensureLocalDirectories(downloadBasePath: string, semesterBasePath: string) {
        if (!fs.existsSync(downloadBasePath)) {
            fs.mkdirSync(downloadBasePath);
        }
        if (!fs.existsSync(semesterBasePath)) {
            fs.mkdirSync(semesterBasePath);
        }
    }

    private static async processDownloadJobs(jobs: DownloadJob[]) {
        for (const job of jobs) {
            console.info("-- Downloading", `"${job.item.name}"`);
            const downloadResponse: AxiosResponse = await myStudyClient.getDownload(job.item.id);
            downloadResponse.data.pipe(fs.createWriteStream(job.downloadFilePath));
            console.info("   Finished");
        }
    }
}

try {
    config();

    const app: App = new App();
    app.run();
} catch (e) {
    console.error("Ein Fehler ist aufgetreten!");
    console.error("Details:", e);
}
