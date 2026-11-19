package com.izcad.viewer;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name="AppUpdates")
public class AppUpdatesPlugin extends Plugin {
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private volatile boolean cancelled, destroyed;
    private volatile Offer offered, staged;
    private static final class Offer {
        final String token=UUID.randomUUID().toString();
        String version,name,url,sha,notes,releaseUrl;long code,size;
        JSObject json(){JSObject o=new JSObject();o.put("token",token);o.put("versionName",version);o.put("versionCode",code);o.put("size",size);o.put("notes",notes);o.put("releaseUrl",releaseUrl);return o;}
    }
    private PackageInfo installed() throws Exception{return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),0);}
    private long code(PackageInfo p){return Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;}
    private JSObject state() throws Exception{PackageInfo p=installed();JSObject s=new JSObject();s.put("enabled",BuildConfig.GITHUB_UPDATES);s.put("versionCode",code(p));s.put("versionName",p.versionName);return s;}
    @PluginMethod public void getState(PluginCall call){try{call.resolve(state());}catch(Exception e){call.reject("Could not read application version.","UPDATE_STATE");}}

    @PluginMethod public void check(PluginCall call){
        executor.execute(()->{try{
            JSObject result=state();if(!BuildConfig.GITHUB_UPDATES){call.resolve(result);return;}
            HttpURLConnection conn=open(UpdateRules.LATEST,false);
            JSONObject release;
            try{int status=conn.getResponseCode();if(status==404){call.resolve(result);return;}if(status!=200)throw new Exception("HTTP "+status);try(InputStream input=conn.getInputStream()){ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int n;while((n=input.read(buffer))!=-1){if(b.size()+n>1024*1024)throw new Exception("Release metadata too large");b.write(buffer,0,n);}release=new JSONObject(b.toString(StandardCharsets.UTF_8.name()));}}finally{conn.disconnect();}
            if(release.optBoolean("draft")||release.optBoolean("prerelease")){call.resolve(result);return;}
            String tag=release.optString("tag_name"),releaseUrl=UpdateRules.REPOSITORY+"/releases/tag/"+tag;
            if(!releaseUrl.equals(release.optString("html_url"))){throw new Exception("Unexpected release URL");}
            JSONArray assets=release.optJSONArray("assets");Offer found=null;
            if(assets!=null)for(int i=0;i<assets.length();i++){
                JSONObject a=assets.getJSONObject(i);long c=UpdateRules.versionCode(tag,a.optString("name"),a.optString("browser_download_url"),a.optString("digest"),a.optLong("size"));
                if(c<=code(installed()))continue;if(found!=null)throw new Exception("Ambiguous APK assets");
                found=new Offer();found.code=c;found.version=tag.substring(1);found.name=a.getString("name");found.url=a.getString("browser_download_url");found.sha=a.getString("digest").substring(7);found.size=a.getLong("size");found.notes=release.optString("body");if(found.notes.length()>12000)found.notes=found.notes.substring(0,12000);found.releaseUrl=releaseUrl;
            }
            offered=found;if(found!=null)result.put("offer",found.json());call.resolve(result);
        }catch(Exception e){call.reject("GitHub update check failed. Try again when connected.","UPDATE_NETWORK");}});
    }
    private HttpURLConnection open(String address,boolean binary) throws Exception{
        if(binary&&!UpdateRules.downloadHost(address))throw new Exception("Unexpected download host");
        HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setConnectTimeout(10000);c.setReadTimeout(20000);c.setInstanceFollowRedirects(false);c.setRequestProperty("User-Agent","Arcad-View/"+BuildConfig.VERSION_NAME);c.setRequestProperty("Accept",binary?"application/octet-stream":"application/vnd.github+json");c.setRequestProperty("Accept-Encoding","identity");return c;
    }
    private HttpURLConnection downloadConnection(String url) throws Exception{
        for(int i=0;i<6;i++){HttpURLConnection c=open(url,true);int status=c.getResponseCode();if(status==200)return c;if(status==301||status==302||status==303||status==307||status==308){String next=c.getHeaderField("Location");c.disconnect();if(next==null)throw new Exception("Missing redirect");url=new URL(new URL(url),next).toString();}else{c.disconnect();throw new Exception("Download HTTP "+status);}}throw new Exception("Too many redirects");
    }
    private File apk() throws Exception{File dir=new File(getContext().getCacheDir(),"updates");if(!dir.isDirectory()&&!dir.mkdirs())throw new Exception("Update storage unavailable");return new File(dir,"verified-update.apk");}
    private String sha(File file) throws Exception{MessageDigest md=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(file)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)md.update(b,0,n);}StringBuilder s=new StringBuilder();for(byte b:md.digest())s.append(String.format("%02x",b&255));return s.toString();}
    private Signature[] signatures(PackageInfo p){return Build.VERSION.SDK_INT>=28?p.signingInfo.getApkContentsSigners():p.signatures;}
    private void verify(File file,Offer offer) throws Exception{
        if(file.length()!=offer.size||!sha(file).equalsIgnoreCase(offer.sha))throw new Exception("APK checksum mismatch");
        PackageManager pm=getContext().getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo archive=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags),current=pm.getPackageInfo(getContext().getPackageName(),flags);
        if(archive==null||!current.packageName.equals(archive.packageName)||code(archive)!=offer.code||code(archive)<=code(current)||!offer.version.equals(archive.versionName))throw new Exception("APK identity or version mismatch");
        Signature[] a=signatures(archive),b=signatures(current);if(a==null||b==null||a.length!=b.length||!Arrays.asList(a).containsAll(Arrays.asList(b)))throw new Exception("APK signer mismatch");
    }
    @PluginMethod public void download(PluginCall call){
        Offer offer=offered;String token=call.getString("token");if(!BuildConfig.GITHUB_UPDATES||offer==null||!offer.token.equals(token)){call.reject("Check this release before downloading.","UPDATE_OFFER");return;}
        cancelled=false;executor.execute(()->{File part=null;try{
            File finalFile=apk();if(finalFile.isFile()&&finalFile.length()==offer.size&&sha(finalFile).equalsIgnoreCase(offer.sha)){verify(finalFile,offer);staged=offer;call.resolve(offer.json());return;}
            part=new File(finalFile.getParentFile(),"download.part.apk");HttpURLConnection conn=downloadConnection(offer.url);
            try{long expected=conn.getContentLengthLong();if(expected>=0&&expected!=offer.size)throw new Exception("Unexpected APK size");try(InputStream in=conn.getInputStream();FileOutputStream output=new FileOutputStream(part)){byte[] b=new byte[65536];long received=0,last=0;int n;while((n=in.read(b))!=-1){if(cancelled||destroyed)throw new Exception("Cancelled");received+=n;if(received>offer.size||received>UpdateRules.MAX_APK_BYTES)throw new Exception("APK too large");output.write(b,0,n);if(System.currentTimeMillis()-last>200){JSObject progress=new JSObject();progress.put("received",received);progress.put("total",offer.size);notifyListeners("progress",progress);last=System.currentTimeMillis();}}output.getFD().sync();}}finally{conn.disconnect();}
            verify(part,offer);if(cancelled||destroyed)throw new Exception("Cancelled");if(finalFile.exists()&&!finalFile.delete())throw new Exception("Cannot replace cached APK");if(!part.renameTo(finalFile))throw new Exception("Cannot stage APK");staged=offer;call.resolve(offer.json());
        }catch(Exception e){if(part!=null)part.delete();call.reject(cancelled?"Update cancelled.":"APK download or verification failed.",cancelled?"UPDATE_CANCELLED":"UPDATE_VERIFY");}});
    }
    @PluginMethod public void cancel(PluginCall call){cancelled=true;call.resolve();}
    @PluginMethod public void install(PluginCall call){
        Offer offer=staged;if(!BuildConfig.GITHUB_UPDATES||offer==null||!offer.token.equals(call.getString("token"))){call.reject("Download and verify this APK before installing.","UPDATE_NOT_READY");return;}
        executor.execute(()->{try{File file=apk();verify(file,offer);if(cancelled)throw new Exception("Cancelled");getActivity().runOnUiThread(()->{try{JSObject result=new JSObject();boolean allowed=getContext().getPackageManager().canRequestPackageInstalls();result.put("permissionRequired",!allowed);if(allowed){Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",file);Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive");intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);getActivity().startActivity(intent);result.put("installerOpened",true);}call.resolve(result);}catch(Exception e){call.reject("Android installer could not be opened.","UPDATE_INSTALL");}});}catch(Exception e){call.reject("The staged update could not be verified.","UPDATE_VERIFY");}});
    }
    @PluginMethod public void openInstallSettings(PluginCall call){if(!BuildConfig.GITHUB_UPDATES){call.reject("GitHub updates are disabled.");return;}try{getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getContext().getPackageName())));call.resolve();}catch(Exception e){call.reject("Installation settings could not be opened.","UPDATE_PERMISSION");}}
    @Override protected void handleOnResume(){super.handleOnResume();notifyListeners("installerResume",new JSObject());}
    @Override protected void handleOnDestroy(){destroyed=true;cancelled=true;executor.shutdownNow();super.handleOnDestroy();}
}
