package com.gramsetu.controller;

import org.springframework.web.bind.annotation.*;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/mesh")
@CrossOrigin
public class MeshController {

    private final List<MeshMessage> relayedMessages = new CopyOnWriteArrayList<>();

    @GetMapping("/host-ip")
    public Map<String, String> getHostIp() {
        Map<String, String> response = new HashMap<>();
        response.put("ip", getLocalIpAddress());
        response.put("port", "8081");
        return response;
    }

    @PostMapping("/relay")
    public MeshMessage relayMessage(@RequestBody MeshMessage message) {
        if (message.getTimestamp() == null || message.getTimestamp().isEmpty()) {
            message.setTimestamp(new java.text.SimpleDateFormat("hh:mm:ss a").format(new Date()));
        }
        // Add to list and keep size limited to 50
        relayedMessages.add(0, message);
        if (relayedMessages.size() > 50) {
            relayedMessages.remove(relayedMessages.size() - 1);
        }
        return message;
    }

    @GetMapping("/messages")
    public List<MeshMessage> getMessages() {
        return relayedMessages;
    }

    private String getLocalIpAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface iface = interfaces.nextElement();
                if (iface.isLoopback() || !iface.isUp() || iface.isVirtual()) continue;

                Enumeration<InetAddress> addresses = iface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    // Choose standard IPv4 non-loopback local address
                    if (addr.getHostAddress().contains(".") && !addr.isLoopbackAddress()) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception e) {
            // fallback
        }
        try {
            return InetAddress.getLocalHost().getHostAddress();
        } catch (Exception e) {
            return "127.0.0.1";
        }
    }

    public static class MeshMessage {
        private String sender;
        private String text;
        private String urgency;
        private String recipient;
        private String timestamp;

        public String getSender() { return sender; }
        public void setSender(String sender) { this.sender = sender; }
        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
        public String getUrgency() { return urgency; }
        public void setUrgency(String urgency) { this.urgency = urgency; }
        public String getRecipient() { return recipient; }
        public void setRecipient(String recipient) { this.recipient = recipient; }
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    }
}
