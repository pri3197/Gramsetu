# Android BLE Mesh Integration Guide (Targeted & Broadcast)

This guide details how to implement the native Android Bluetooth Low Energy (BLE) layer in Kotlin to bridge with the GramSetu web interface. This system supports both **Broadcast (All Peers)** and **Personalized (Targeted)** notifications.

---

## 1. WebView Setup

To integrate the JavaScript Native Bridge, configure the WebView settings and register a `WebAppInterface` matching the namespace `window.Android`.

```kotlin
import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var webAppInterface: WebAppInterface

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        
        // Enable JavaScript
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true

        // Register the JS native bridge (window.Android)
        webAppInterface = WebAppInterface(this, webView)
        webView.addJavascriptInterface(webAppInterface, "Android")

        // Load GramSetu Web App
        webView.loadUrl("https://localhost:8081")
    }
}
```

---

## 2. JavaScript Interface (Outbound & Inbound Bridge)

Implement the bridge class that handles outbound calls (`broadcastMeshMessage` with recipient parameters) and pushes inbound updates back to the web layer.

```kotlin
import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast

class WebAppInterface(private val context: Context, private val webView: WebView) {

    /**
     * Resolve strict hardware-based device model and hash identity
     */
    @JavascriptInterface
    fun getDeviceName(): String {
        val model = android.os.Build.MODEL.replace(" ", "")
        val androidId = android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        )
        val shortHash = if (androidId != null && androidId.length >= 4) {
            androidId.substring(androidId.length - 4)
        } else {
            "0000"
        }
        return "$model-$shortHash"
    }

    /**
     * Outbound Bridge: Called from window.Android.broadcastMeshMessage(text, urgency, recipient)
     */
    @JavascriptInterface
    fun broadcastMeshMessage(text: String, urgency: String, recipient: String) {
        val target = if (recipient.isEmpty()) "All Peers" else recipient
        Toast.makeText(context, "Broadcasting to [$target] ($urgency): $text", Toast.LENGTH_SHORT).show()
        
        // Pass payload directly to native BLE advertisement layer
        BleMeshManager.startBroadcasting(text, urgency, recipient)
    }

    /**
     * Inbound Bridge: Call this function when native BLE scanner captures a peer alert
     */
    fun receiveMeshMessage(sender: String, text: String, urgency: String, timestamp: String, recipient: String) {
        // Evaluate JavaScript callback on WebView thread
        webView.post {
            val jsCode = "javascript:window.receiveMeshMessage(" +
                    "'$sender', " +
                    "'${text.replace("'", "\\'")}', " +
                    "'$urgency', " +
                    "'$timestamp', " +
                    "'$recipient');"
            webView.evaluateJavascript(jsCode, null)
        }
    }
}
```

---

## 3. Native BLE Broadcaster (Advertising & Payload Packing)

> [!IMPORTANT]
> **Payload Layout (BLE Service Data)**:
> - **Byte 0**: Urgency level (`0x01` = emergency, `0x02` = warning, `0x03` = info)
> - **Byte 1**: Recipient Handle Length ($L_R$)
> - **Bytes 2 to $2 + L_R - 1$**: Recipient Handle string (ASCII, up to 10 bytes)
> - **Remaining Bytes**: Message Text (UTF-8)

```kotlin
import android.bluetooth.BluetoothAdapter
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.os.ParcelUuid
import android.util.Log
import java.nio.charset.StandardCharsets
import java.util.UUID

object BleMeshManager {
    private const val TAG = "BleMeshManager"
    
    // GramSetu Custom BLE Service UUID
    private val MESH_SERVICE_UUID = UUID.fromString("0000feaa-0000-1000-8000-00805f9b34fb")

    private val bluetoothAdapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()
    private var advertiser: BluetoothLeAdvertiser? = bluetoothAdapter?.bluetoothLeAdvertiser
    private var advertiseCallback: AdvertiseCallback? = null

    fun startBroadcasting(text: String, urgency: String, recipient: String) {
        if (advertiser == null) {
            Log.e(TAG, "BLE Advertising not supported on this device.")
            return
        }

        // 1. Resolve urgency byte
        val urgencyByte = when (urgency.lowercase()) {
            "emergency" -> 0x01.toByte()
            "warning" -> 0x02.toByte()
            else -> 0x03.toByte()
        }

        // 2. Resolve recipient bytes
        val cleanRecipient = if (recipient.length > 10) recipient.substring(0, 10) else recipient
        val recipientBytes = cleanRecipient.toByteArray(StandardCharsets.US_ASCII)
        val recipientLen = recipientBytes.size.toByte()

        // 3. Resolve message text bytes
        val textBytes = text.toByteArray(StandardCharsets.UTF_8)

        // 4. Assemble payload
        val payload = ByteArray(2 + recipientBytes.size + textBytes.size)
        payload[0] = urgencyByte
        payload[1] = recipientLen
        if (recipientBytes.isNotEmpty()) {
            System.arraycopy(recipientBytes, 0, payload, 2, recipientBytes.size)
        }
        System.arraycopy(textBytes, 0, payload, 2 + recipientBytes.size, textBytes.size)

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(false)
            .build()

        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .addServiceUuid(ParcelUuid(MESH_SERVICE_UUID))
            .addServiceData(ParcelUuid(MESH_SERVICE_UUID), payload)
            .build()

        stopBroadcasting()

        advertiseCallback = object : AdvertiseCallback() {
            override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
                super.onStartSuccess(settingsInEffect)
                Log.d(TAG, "BLE advertising started successfully.")
            }

            override fun onStartFailure(errorCode: Int) {
                super.onStartFailure(errorCode)
                Log.e(TAG, "BLE advertising failed: $errorCode")
            }
        }

        advertiser?.startAdvertising(settings, data, advertiseCallback)
    }

    fun stopBroadcasting() {
        advertiseCallback?.let {
            advertiser?.stopAdvertising(it)
            advertiseCallback = null
        }
    }
}
```

---

## 4. Native BLE Receiver (Scanning & Payload Parsing)

Set up the scanner to filter advertisements, unpack the packet fields, and pass them back to the WebView interface.

```kotlin
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.os.ParcelUuid
import android.util.Log
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class BleMeshScanner(private val webBridge: WebAppInterface) {
    private const val TAG = "BleMeshScanner"
    
    private val scanner: BluetoothLeScanner? = BluetoothAdapter.getDefaultAdapter()?.bluetoothLeScanner
    private var scanCallback: ScanCallback? = null

    fun startScanning() {
        if (scanner == null) return

        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(BleMeshManager.MESH_SERVICE_UUID))
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        scanCallback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                super.onScanResult(callbackType, result)
                
                val record = result.scanRecord ?: return
                val serviceData = record.getServiceData(ParcelUuid(BleMeshManager.MESH_SERVICE_UUID)) ?: return

                if (serviceData.size >= 2) {
                    // Unpack payload
                    val urgencyByte = serviceData[0]
                    val urgency = when (urgencyByte.toInt()) {
                        0x01 -> "emergency"
                        0x02 -> "warning"
                        else -> "info"
                    }

                    val recipientLen = serviceData[1].toInt()
                    
                    if (serviceData.size < 2 + recipientLen) return

                    // Extract recipient handle
                    val recipient = if (recipientLen > 0) {
                        String(serviceData, 2, recipientLen, StandardCharsets.US_ASCII)
                    } else {
                        ""
                    }

                    // Extract text message content
                    val textStart = 2 + recipientLen
                    val textLen = serviceData.size - textStart
                    val text = String(serviceData, textStart, textLen, StandardCharsets.UTF_8)
                    
                    val sender = record.deviceName ?: "Peer-${result.device.address.takeLast(5)}"
                    val timestamp = SimpleDateFormat("hh:mm:ss a", Locale.getDefault()).format(Date())

                    // Notify WebView
                    webBridge.receiveMeshMessage(sender, text, urgency, timestamp, recipient)
                }
            }

            override fun onScanFailed(errorCode: Int) {
                super.onScanFailed(errorCode)
                Log.e(TAG, "BLE scanning failed: $errorCode")
            }
        }

        scanner?.startScan(listOf(filter), settings, scanCallback)
    }

    fun stopScanning() {
        scanCallback?.let {
            scanner?.stopScan(it)
            scanCallback = null
        }
    }
}
```
