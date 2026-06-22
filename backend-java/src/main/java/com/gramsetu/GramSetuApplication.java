package com.gramsetu;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.MemberCategory;

@SpringBootApplication
@EnableScheduling
@ImportRuntimeHints(GramSetuApplication.GramSetuHints.class)
public class GramSetuApplication {

    static class GramSetuHints implements RuntimeHintsRegistrar {
        @Override
        public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
            // Allow Jackson to deserialize into Map<String, Object>
            hints.reflection().registerType(java.util.LinkedHashMap.class,
                MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                MemberCategory.INVOKE_PUBLIC_METHODS);
            hints.reflection().registerType(java.util.ArrayList.class,
                MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                MemberCategory.INVOKE_PUBLIC_METHODS);
        }
    }

    public static void main(String[] args) {
        SpringApplication.run(GramSetuApplication.class, args);
    }
}
