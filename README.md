# MyStudy Material Sync

This is an Open Source tool for automatically downloading seminar and lecture materials from the online platform MyStudy at the **Leuphana University Lüneburg**. It uses your login credentials and looks up the course materials that you are registered for. It then replicates the course and directory structure to `<UserDirectory>/MyStudy-Material/<Semester>` and downloads all files that do not yet exist on your local computer.

## Limitations

- **This tool is currently targeted at programming-experienced users.** It would be cool to further improve it so that it's easy to use for everyone. Let me know if you're interested!
- The tool does not work with password-protected lectures or directories.
- The tool does only compare file names in order to decide whether to download a file or not. If a lecturer has changed file contents in MyStudy but has not changed the file's name, it will not be redownloaded. **So file contents may get out of date.**
- This tool is not officially supported by Leuphana University Lüneburg or the MIZ. When there are updates to MyStudy, the tool may break.
- The tool always only synchronizes the materials for the semester that you are currently logged in to.

> ⚠️ **Warning**: Always consider the MyStudy portal to be the only source of *truth*. This tool is far from perfect. It may fail or not keep your local files up-to-date correctly.

## Setup

> Note: Requires nodeJs, npm, typescript and git to be installed. This short guide works for Linux and macOS computers. For Windows, you have to adapt the commands accordingly.

To use this tool, first clone this git repository to your local machine and install the dependencies.

```shell
$ git clone git@github.com:vituslehner/mystudy-material-sync.git
$ npm install
```

Then place the following `.env` file in the project root (replace credentials):

```shell
MYSTUDY_USERNAME=max.m
MYSTUDY_PASSWORD=xxxxxxxx
```

To start a sync, run:

```shell
$ npm start
```

Sample output:
```
> mystudy-material-sync@0.1.0 start /Users/xxx/fr8ings/mystudy-material-sync
> npm run build-ts && node dist/app.js


> mystudy-material-sync@0.1.0 build-ts /Users/xxx/fr8ings/mystudy-material-sync
> tsc

-- User directory: /Users/xxx
-- Download directory: /Users/xxx/MyStudy-Material

-- Login successful!
-- Semester: SoSe-2019
-- Semester directory: /Users/xxx/MyStudy-Material/SoSe-2019

Enrollments:
 ▸ Life Cycle Assessment (LCA) & Material Flow Analysis (MFA) 1088397
 ▸ ...
-- Downloading "MoSi_9_SOSE_2019.pptx.pdf"
   Finished
-- Downloading "MoSi_11_SOSE_2019.pptx.pdf"
   Finished
```

The TypeScript code should be compiled and executed.

## Contact

If you have questions or would like to improve the tool, just contact me using my Leuphana student mail address for `vitus.lehner`.