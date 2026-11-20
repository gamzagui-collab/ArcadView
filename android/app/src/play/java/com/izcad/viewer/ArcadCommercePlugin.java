package com.izcad.viewer;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Transport only: balances, purchase verification, consume and acknowledge live on the server. */
@CapacitorPlugin(name = "ArcadCommerce")
public final class ArcadCommercePlugin extends Plugin {
    private static final String STANDARD = "standard_500_credits", PRO = "pro_monthly", KEY = "arcad.account.session.v1";
    private BillingClient billing;
    private CredentialManager credentials;
    private CancellationSignal credentialRequest;
    private final List<Runnable> connected = new ArrayList<>();
    private final List<PluginCall> connecting = new ArrayList<>();
    private boolean starting;
    @Override public void load() { credentials = CredentialManager.create(getContext()); }
    @PluginMethod public void getConfig(PluginCall call) {
        JSObject out = new JSObject(); out.put("enabled", true); out.put("server", BuildConfig.ACCOUNT_SERVER);
        out.put("distribution", "play"); out.put("packageName", getContext().getPackageName()); call.resolve(out);
    }
    @PluginMethod public void signIn(PluginCall call) {
        String clientId = call.getString("clientId", ""), nonce = call.getString("nonce", "");
        if (!clientId.endsWith(".apps.googleusercontent.com") || !nonce.matches("[A-Za-z0-9_-]{43}")) { call.reject("AUTH_NOT_CONFIGURED"); return; }
        getActivity().runOnUiThread(() -> {
            if (credentialRequest != null) { call.reject("AUTH_IN_PROGRESS"); return; }
            credentialRequest = new CancellationSignal();
            GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(clientId).setNonce(nonce).build();
            GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
            credentials.getCredentialAsync(getActivity(), request, credentialRequest, ContextCompat.getMainExecutor(getContext()),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override public void onResult(GetCredentialResponse result) {
                        credentialRequest = null;
                        try {
                            if (!(result.getCredential() instanceof CustomCredential)) throw new IllegalStateException();
                            CustomCredential c = (CustomCredential) result.getCredential();
                            if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) throw new IllegalStateException();
                            JSObject out = new JSObject(); out.put("idToken", GoogleIdTokenCredential.createFrom(c.getData()).getIdToken()); call.resolve(out);
                        } catch (Exception ignored) { call.reject("INVALID_GOOGLE_CREDENTIAL"); }
                    }
                    @Override public void onError(GetCredentialException ignored) { credentialRequest = null; call.reject("GOOGLE_SIGN_IN_CANCELLED_OR_UNAVAILABLE"); }
                });
        });
    }
    private SharedPreferences prefs() { return getContext().getSharedPreferences("arcad-account", Context.MODE_PRIVATE); }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(KEY)) {
            KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            gen.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build()); gen.generateKey();
        }
        return (SecretKey) store.getKey(KEY, null);
    }
    @PluginMethod public void saveSession(PluginCall call) {
        String session = call.getString("session", "");
        if (session.length() > 4096 || session.length() < 20) { call.reject("INVALID_SESSION"); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
            String value = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." + Base64.encodeToString(cipher.doFinal(session.getBytes(java.nio.charset.StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!prefs().edit().putString("session", value).commit()) throw new IllegalStateException(); call.resolve();
        } catch (Exception ignored) { call.reject("SESSION_STORAGE_UNAVAILABLE"); }
    }
    @PluginMethod public void readSession(PluginCall call) {
        JSObject out = new JSObject(); String value = prefs().getString("session", null);
        if (value != null) try {
            String[] p = value.split("\\."); Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(p[0], Base64.NO_WRAP)));
            out.put("session", new String(c.doFinal(Base64.decode(p[1], Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception ignored) { call.reject("SESSION_STORAGE_UNAVAILABLE"); return; }
        call.resolve(out);
    }
    @PluginMethod public void clearSession(PluginCall call) {
        if (!prefs().edit().remove("session").commit()) { call.reject("SESSION_STORAGE_UNAVAILABLE"); return; }
        credentials.clearCredentialStateAsync(new ClearCredentialStateRequest(), null, ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override public void onResult(Void result) { call.resolve(); }
                @Override public void onError(ClearCredentialException ignored) { call.resolve(); }
            });
    }
    private void ready(PluginCall call, Runnable action) {
        getActivity().runOnUiThread(() -> {
            if (billing == null) billing = BillingClient.newBuilder(getContext())
                .setListener((result, purchases) -> {
                    JSObject out = new JSObject(); out.put("code", result.getResponseCode()); out.put("purchases", purchases(purchases)); notifyListeners("purchases", out);
                }).enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()).enableAutoServiceReconnection().build();
            if (billing.isReady()) { action.run(); return; }
            connected.add(action); connecting.add(call); if (starting) return; starting = true;
            billing.startConnection(new BillingClientStateListener() {
                @Override public void onBillingServiceDisconnected() { }
                @Override public void onBillingSetupFinished(BillingResult result) {
                    starting = false; List<Runnable> actions = new ArrayList<>(connected); List<PluginCall> calls = new ArrayList<>(connecting);
                    connected.clear(); connecting.clear();
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) for (Runnable a : actions) a.run();
                    else for (PluginCall c : calls) c.reject("PLAY_BILLING_UNAVAILABLE_" + result.getResponseCode());
                }
            });
        });
    }
    private static JSArray purchases(List<Purchase> values) {
        JSArray out = new JSArray(); if (values == null) return out;
        for (Purchase p : values) {
            JSObject item = new JSObject(); item.put("token", p.getPurchaseToken()); item.put("products", new JSArray(p.getProducts()));
            item.put("state", p.getPurchaseState()); item.put("acknowledged", p.isAcknowledged()); out.put(item);
        } return out;
    }
    private interface ProductCallback { void result(ProductDetails p); }
    private void query(String id, PluginCall call, ProductCallback callback) {
        String type = id.equals(PRO) ? BillingClient.ProductType.SUBS : BillingClient.ProductType.INAPP;
        billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(
            QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build())).build(), (result, data) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || data.getProductDetailsList().isEmpty()) { call.reject("PRODUCT_UNAVAILABLE_" + id); return; }
                callback.result(data.getProductDetailsList().get(0));
            });
    }
    private static JSObject product(ProductDetails p) {
        JSObject out = new JSObject(); out.put("id", p.getProductId()); out.put("name", p.getName()); out.put("description", p.getDescription());
        if (p.getProductId().equals(STANDARD)) {
            List<ProductDetails.OneTimePurchaseOfferDetails> offers = p.getOneTimePurchaseOfferDetailsList();
            if (offers != null && !offers.isEmpty()) { ProductDetails.OneTimePurchaseOfferDetails o = offers.get(0); out.put("price", o.getFormattedPrice()); out.put("offerToken", o.getOfferToken()); }
        } else if (p.getSubscriptionOfferDetails() != null) for (ProductDetails.SubscriptionOfferDetails o : p.getSubscriptionOfferDetails()) {
            List<ProductDetails.PricingPhase> phases = o.getPricingPhases().getPricingPhaseList();
            if (o.getOfferId() == null && phases.size() == 1 && "P1M".equals(phases.get(0).getBillingPeriod())) {
                out.put("price", phases.get(0).getFormattedPrice()); out.put("period", "P1M"); out.put("offerToken", o.getOfferToken()); break;
            }
        }
        return out;
    }
    @PluginMethod public void products(PluginCall call) {
        ready(call, () -> query(STANDARD, call, a -> query(PRO, call, b -> {
            JSArray items = new JSArray(); items.put(product(a)); items.put(product(b)); JSObject out = new JSObject(); out.put("products", items); call.resolve(out);
        })));
    }
    @PluginMethod public void purchase(PluginCall call) {
        String id = call.getString("productId", ""), offer = call.getString("offerToken", ""), account = call.getString("accountId", "");
        if ((!id.equals(PRO) && !id.equals(STANDARD)) || !account.matches("[a-f0-9]{64}") || offer.isEmpty()) { call.reject("INVALID_PURCHASE"); return; }
        ready(call, () -> query(id, call, p -> {
            JSObject details = product(p);
            if (!offer.equals(details.getString("offerToken"))) { call.reject("PRODUCT_CHANGED_RELOAD_PRICE"); return; }
            getActivity().runOnUiThread(() -> {
                BillingResult r = billing.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder().setObfuscatedAccountId(account)
                    .setProductDetailsParamsList(Collections.singletonList(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(p).setOfferToken(offer).build())).build());
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) call.reject("PURCHASE_NOT_STARTED_" + r.getResponseCode()); else call.resolve();
            });
        }));
    }
    @PluginMethod public void restore(PluginCall call) {
        ready(call, () -> billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (a, one) -> {
            if (a.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("PURCHASE_QUERY_FAILED"); return; }
            billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (b, two) -> {
                if (b.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("PURCHASE_QUERY_FAILED"); return; }
                List<Purchase> all = new ArrayList<>(one); all.addAll(two); JSObject out = new JSObject(); out.put("purchases", purchases(all)); call.resolve(out);
            });
        }));
    }
    @Override protected void handleOnResume() { if (billing != null && billing.isReady()) notifyListeners("resume", new JSObject()); }
    @Override protected void handleOnDestroy() {
        if (credentialRequest != null) credentialRequest.cancel(); if (billing != null) billing.endConnection();
        for (PluginCall c : connecting) c.reject("APP_CLOSED"); connecting.clear(); connected.clear(); super.handleOnDestroy();
    }
}
