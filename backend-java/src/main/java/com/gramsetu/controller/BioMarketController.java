package com.gramsetu.controller;

import com.gramsetu.model.BioProduct;
import com.gramsetu.model.User;
import com.gramsetu.repository.BioProductRepository;
import com.gramsetu.repository.UserRepository;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/market")
public class BioMarketController {

    private static final Logger log = LoggerFactory.getLogger(BioMarketController.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BioProductRepository bioProductRepository;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody User user) {
        log.info("Registering new user: {}", user.getUsername());
        
        if (userRepository.findByUsername(user.getUsername()).isPresent()) {
            Map<String, String> response = new HashMap<>();
            response.put("error", "Username is already taken");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
        
        if (user.getRole() == null || user.getRole().isEmpty()) {
            user.setRole("SELLER");
        }
        
        User savedUser = userRepository.save(user);
        return ResponseEntity.ok(savedUser);
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");
        
        log.info("Attempting login for user: {}", username);
        
        Optional<User> userOpt = userRepository.findByUsername(username);
        if (userOpt.isPresent() && userOpt.get().getPassword().equals(password)) {
            User user = userOpt.get();
            // Do not send password back to the client
            User safeUser = new User(user.getId(), user.getUsername(), null, user.getName(), user.getContact(), user.getRole());
            return ResponseEntity.ok(safeUser);
        }
        
        Map<String, String> response = new HashMap<>();
        response.put("error", "Invalid username or password");
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @GetMapping("/products")
    public ResponseEntity<List<BioProduct>> getProducts() {
        log.info("Fetching all bio products");
        return ResponseEntity.ok(bioProductRepository.findAll());
    }

    @PostMapping("/products")
    public ResponseEntity<?> createProduct(@RequestBody BioProduct product) {
        log.info("Creating new bio product advertisement: {}", product.getTitle());
        
        if (product.getTitle() == null || product.getTitle().isEmpty()) {
            Map<String, String> response = new HashMap<>();
            response.put("error", "Product title is required");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
        
        product.setCreatedDate(LocalDate.now());
        BioProduct savedProduct = bioProductRepository.save(product);
        return ResponseEntity.ok(savedProduct);
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<?> deleteProduct(@PathVariable Long id) {
        log.info("Deleting bio product: {}", id);
        
        if (!bioProductRepository.existsById(id)) {
            Map<String, String> response = new HashMap<>();
            response.put("error", "Product not found");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }
        
        bioProductRepository.deleteById(id);
        Map<String, String> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Product successfully removed");
        return ResponseEntity.ok(response);
    }
}
