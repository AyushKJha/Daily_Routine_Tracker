import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Arrays;
import java.util.Collections;

public final class SignApk {
    public static void main(String[] args) throws Exception {
        if (args.length != 3) throw new IllegalArgumentException("Usage: SignApk keystore input.apk output.apk");
        String value = System.getenv("DAILY_KEYSTORE_PASSWORD");
        if (value == null) throw new IllegalStateException("Set DAILY_KEYSTORE_PASSWORD without logging it");
        char[] password = value.toCharArray();
        KeyStore store = KeyStore.getInstance("PKCS12");
        try (FileInputStream stream = new FileInputStream(args[0])) { store.load(stream, password); }
        PrivateKey key = (PrivateKey) store.getKey("daily", password);
        X509Certificate cert = (X509Certificate) store.getCertificate("daily");
        Arrays.fill(password, '\0');
        ApkSigner.SignerConfig config = new ApkSigner.SignerConfig.Builder("daily", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(config)).setInputApk(new File(args[1]))
                .setOutputApk(new File(args[2])).setMinSdkVersion(26)
                .setV1SigningEnabled(true).setV2SigningEnabled(true).setV3SigningEnabled(true)
                .setV4SigningEnabled(false).build().sign();
        ApkVerifier.Result checked = new ApkVerifier.Builder(new File(args[2])).build().verify();
        if (!checked.isVerified() || !checked.isVerifiedUsingV2Scheme()) throw new IllegalStateException("APK signature verification failed: " + checked.getErrors());
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(cert.getEncoded());
        StringBuilder fingerprint = new StringBuilder();
        for (byte b : digest) fingerprint.append(String.format("%02x", b));
        System.out.println("APK signature verified (v2/v3). Certificate SHA-256: " + fingerprint);
    }
}
