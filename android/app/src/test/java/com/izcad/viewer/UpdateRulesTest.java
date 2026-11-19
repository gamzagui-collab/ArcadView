package com.izcad.viewer;

import org.junit.Test;
import static org.junit.Assert.*;

public class UpdateRulesTest {
    private final String name="Arcad-View-v2.1.0-27.apk", tag="v2.1.0", digest="sha256:"+new String(new char[64]).replace('\0','a');
    private String url(){return UpdateRules.REPOSITORY+"/releases/download/"+tag+"/"+name;}
    @Test public void acceptsVersionedApkWithDigest(){assertEquals(27,UpdateRules.versionCode(tag,name,url(),digest,12881785));}
    @Test public void refusesForeignOrAmbiguousAssets(){assertEquals(-1,UpdateRules.versionCode(tag,name,url().replace("gamzagui-collab","other"),digest,100));assertEquals(-1,UpdateRules.versionCode(tag,name,url()+"?redirect=other",digest,100));assertEquals(-1,UpdateRules.versionCode("v2.2.0",name,url(),digest,100));}
    @Test public void requiresDigestAndBoundedSize(){assertEquals(-1,UpdateRules.versionCode(tag,name,url(),"",100));assertEquals(-1,UpdateRules.versionCode(tag,name,url(),digest,0));assertEquals(-1,UpdateRules.versionCode(tag,name,url(),digest,UpdateRules.MAX_APK_BYTES+1));}
    @Test public void refusesInvalidOrOverflowedVersionCodes(){for(String code:new String[]{"0","027","2100000001","999999999999999999999"}){String n="Arcad-View-v2.1.0-"+code+".apk";assertEquals(-1,UpdateRules.versionCode(tag,n,UpdateRules.REPOSITORY+"/releases/download/"+tag+"/"+n,digest,100));}}
    @Test public void permitsOnlyHttpsGithubDownloadHosts(){assertTrue(UpdateRules.downloadHost(url()));assertTrue(UpdateRules.downloadHost("https://release-assets.githubusercontent.com/path?signature=x"));for(String s:new String[]{"http://github.com/file","https://github.com.evil.example/file","https://github.com@evil.example/file","https://github.com:8443/file","file:///tmp/file","https://example.com/file"})assertFalse(s,UpdateRules.downloadHost(s));}
}
