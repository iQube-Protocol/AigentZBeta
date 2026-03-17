export class BrowserStagehandExec {
    getStatus() {
        return {
            configured: false,
            mode: 'stub',
            message: 'Stagehand execution is reserved for a later slice.',
        };
    }
}
export const browserStagehandExec = new BrowserStagehandExec();
