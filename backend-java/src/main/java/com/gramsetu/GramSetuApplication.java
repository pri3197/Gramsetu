package com.gramsetu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class GramSetuApplication {
    public static void main(String[] args) {
        SpringApplication.run(GramSetuApplication.class, args);
    }
}
