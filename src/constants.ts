//
// Copyright (c) 2017 Vitus Lehner. All rights reserved.
// Licensed under the MIT License. See LICENSE file in
// the project root for full license information.
//

export const constants: any = {
    remote: {
        baseUrl: "https://mystudy.leuphana.de",
        endpoints: {
            homepage: "/portal/home",
            login: "/login/login",
            dashboard: "/dashboard/default",
            enrollments: "//anmeldungStudenten/get",
            enrollment: "/veranstaltungInformation/show?veranstaltung_id=",
            fileManager: "/dateimanager/veranstaltung?veranstaltung_id=",
            fileManagerGetDirectory: "/dateimanager/getDirectory",
            download: "/dateimanager/download?type=file&id="
        }
    },
    local: {
        downloadDirectory: "~/MyStudy-Material"
    }
};
