import{expect,it}from"vitest";import{shouldCheckUpdate,UPDATE_INTERVAL,updateProgress}from"./updatePolicy";
it("checks on first launch, after its interval, and after clock rollback",()=>{expect(shouldCheckUpdate(100,null)).toBe(true);expect(shouldCheckUpdate(UPDATE_INTERVAL+100,100)).toBe(true);expect(shouldCheckUpdate(50,100)).toBe(true);});
it("throttles repeated resumes while tolerating corrupt stored timestamps",()=>{expect(shouldCheckUpdate(200,100)).toBe(false);expect(shouldCheckUpdate(200,NaN)).toBe(true);expect(shouldCheckUpdate(200,-1)).toBe(true);});
it("bounds download progress and handles missing totals",()=>{expect(updateProgress(50,100)).toBe(50);expect(updateProgress(101,100)).toBe(100);expect(updateProgress(0,0)).toBe(null);expect(updateProgress(-1,10)).toBe(null);});
