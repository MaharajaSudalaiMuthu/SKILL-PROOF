import { describe, it, expect } from 'vitest';
import { parseJavaFile } from '../../src/detectors/ast/javaAstHelper.js';
import { SymbolIndex } from '../../src/detectors/ast/symbolIndex.js';
import { detectRestController } from '../../src/detectors/impl/restControllerDetector.js';
import { detectJpaHibernate } from '../../src/detectors/impl/jpaHibernateDetector.js';
import { detectSpringSecurity } from '../../src/detectors/impl/springSecurityDetector.js';
import { detectJwt } from '../../src/detectors/impl/jwtDetector.js';
import { detectExceptionHandling } from '../../src/detectors/impl/exceptionHandlingDetector.js';
import { detectUnitTest } from '../../src/detectors/impl/unitTestDetector.js';
import { detectTransaction } from '../../src/detectors/impl/transactionDetector.js';
import { detectInputValidation } from '../../src/detectors/impl/inputValidationDetector.js';

describe('Java AST Capability Detectors (R5 Unit Tests)', () => {
  describe('rest-controller-design', () => {
    it('detects a qualifying @RestController with >=2 HTTP verbs, input binding, and non-void return', () => {
      const code = `
        package com.example.demo.controller;
        import org.springframework.web.bind.annotation.*;
        import org.springframework.http.ResponseEntity;

        @RestController
        @RequestMapping("/api/users")
        public class UserController {
          @GetMapping("/{id}")
          public ResponseEntity<String> getUser(@PathVariable Long id) {
            return ResponseEntity.ok("user" + id);
          }

          @PostMapping
          public ResponseEntity<String> createUser(@RequestBody String user) {
            return ResponseEntity.ok(user);
          }
        }
      `;
      const file = parseJavaFile('src/main/java/UserController.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectRestController(file, index);

      expect(findings).toHaveLength(1);
      expect(findings[0].skillSlug).toBe('rest-controller-design');
      expect(findings[0].keyAttributes.verbs).toContain('GET');
      expect(findings[0].keyAttributes.verbs).toContain('POST');
      expect(findings[0].keyAttributes.usesResponseEntity).toBe(true);
    });

    it('rejects near-miss: controller with only 1 HTTP verb', () => {
      const code = `
        package com.example.demo.controller;
        import org.springframework.web.bind.annotation.*;

        @RestController
        public class SingleVerbController {
          @GetMapping("/api/test")
          public String getTest(@RequestParam String q) {
            return q;
          }
        }
      `;
      const file = parseJavaFile('src/main/java/SingleVerbController.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectRestController(file, index);

      expect(findings).toHaveLength(0);
    });

    it('rejects near-miss: controller with 2 verbs but missing input binding', () => {
      const code = `
        package com.example.demo.controller;
        import org.springframework.web.bind.annotation.*;

        @RestController
        public class NoBindingController {
          @GetMapping("/api/ping")
          public String ping() {
            return "pong";
          }

          @PostMapping("/api/reset")
          public String reset() {
            return "ok";
          }
        }
      `;
      const file = parseJavaFile('src/main/java/NoBindingController.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectRestController(file, index);

      expect(findings).toHaveLength(0);
    });

    it('rejects near-miss: controller with void returns only', () => {
      const code = `
        package com.example.demo.controller;
        import org.springframework.web.bind.annotation.*;

        @RestController
        public class VoidController {
          @GetMapping("/{id}")
          public void getOne(@PathVariable Long id) {
          }

          @PostMapping
          public void saveOne(@RequestBody String body) {
          }
        }
      `;
      const file = parseJavaFile('src/main/java/VoidController.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectRestController(file, index);

      expect(findings).toHaveLength(0);
    });
  });

  describe('jpa-hibernate-persistence', () => {
    it('detects @Entity with @Id and matching Spring Data repository', () => {
      const entityCode = `
        package com.example.demo.model;
        import jakarta.persistence.*;

        @Entity
        public class Product {
          @Id
          @GeneratedValue(strategy = GenerationType.IDENTITY)
          private Long id;
          private String name;
        }
      `;
      const repoCode = `
        package com.example.demo.repo;
        import org.springframework.data.jpa.repository.JpaRepository;
        import com.example.demo.model.Product;

        public interface ProductRepository extends JpaRepository<Product, Long> {
        }
      `;

      const entityFile = parseJavaFile('src/main/java/Product.java', entityCode);
      const repoFile = parseJavaFile('src/main/java/ProductRepository.java', repoCode);
      const index = new SymbolIndex([entityFile, repoFile]);

      const findings = detectJpaHibernate(entityFile, index);
      expect(findings).toHaveLength(1);
      expect(findings[0].skillSlug).toBe('jpa-hibernate-persistence');
      expect(findings[0].keyAttributes.entityName).toBe('Product');
      expect(findings[0].keyAttributes.idFieldName).toBe('id');
      expect(findings[0].keyAttributes.persistenceMechanism).toBe('ProductRepository');
    });

    it('detects @Entity with EntityManager usage in another file', () => {
      const entityCode = `
        package com.example.demo.model;
        import jakarta.persistence.*;

        @Entity
        public class Order {
          @Id
          private Long id;
        }
      `;
      const daoCode = `
        package com.example.demo.dao;
        import jakarta.persistence.EntityManager;
        import com.example.demo.model.Order;

        public class OrderDao {
          private EntityManager entityManager;

          public Order find(Long id) {
            return entityManager.find(Order.class, id);
          }
        }
      `;

      const entityFile = parseJavaFile('src/main/java/Order.java', entityCode);
      const daoFile = parseJavaFile('src/main/java/OrderDao.java', daoCode);
      const index = new SymbolIndex([entityFile, daoFile]);

      const findings = detectJpaHibernate(entityFile, index);
      expect(findings).toHaveLength(1);
      expect(findings[0].keyAttributes.persistenceMechanism).toBe('EntityManager');
    });

    it('rejects near-miss: @Entity without @Id field', () => {
      const entityCode = `
        package com.example.demo.model;
        import jakarta.persistence.Entity;

        @Entity
        public class NoIdEntity {
          private String name;
        }
      `;
      const repoCode = `
        public interface NoIdRepo extends JpaRepository<NoIdEntity, Long> {}
      `;
      const entityFile = parseJavaFile('src/main/java/NoIdEntity.java', entityCode);
      const repoFile = parseJavaFile('src/main/java/NoIdRepo.java', repoCode);
      const index = new SymbolIndex([entityFile, repoFile]);

      const findings = detectJpaHibernate(entityFile, index);
      expect(findings).toHaveLength(0);
    });

    it('rejects near-miss: @Entity with @Id but no repo and no EntityManager', () => {
      const entityCode = `
        package com.example.demo.model;
        import jakarta.persistence.*;

        @Entity
        public class OrphanEntity {
          @Id
          private Long id;
        }
      `;
      const entityFile = parseJavaFile('src/main/java/OrphanEntity.java', entityCode);
      const index = new SymbolIndex([entityFile]);

      const findings = detectJpaHibernate(entityFile, index);
      expect(findings).toHaveLength(0);
    });
  });

  describe('spring-security-configuration', () => {
    it('detects Spring Security configuration with request authorization rules', () => {
      const code = `
        package com.example.demo.config;
        import org.springframework.context.annotation.Configuration;
        import org.springframework.context.annotation.Bean;
        import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
        import org.springframework.security.web.SecurityFilterChain;
        import org.springframework.security.config.annotation.web.builders.HttpSecurity;

        @Configuration
        @EnableWebSecurity
        public class SecurityConfig {
          @Bean
          public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
            http.authorizeHttpRequests(auth -> auth
              .requestMatchers("/api/public/**").permitAll()
              .anyRequest().authenticated()
            );
            return http.build();
          }
        }
      `;
      const file = parseJavaFile('src/main/java/SecurityConfig.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectSpringSecurity(file, index);

      expect(findings).toHaveLength(1);
      expect(findings[0].skillSlug).toBe('spring-security-configuration');
      expect(findings[0].keyAttributes.rules).toContain('authorizeHttpRequests');
      expect(findings[0].keyAttributes.rules).toContain('authenticated');
    });

    it('rejects configuration class without security authorization rules', () => {
      const code = `
        package com.example.demo.config;
        import org.springframework.context.annotation.Configuration;

        @Configuration
        public class AppConfig {
          public String something() { return "hello"; }
        }
      `;
      const file = parseJavaFile('src/main/java/AppConfig.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectSpringSecurity(file, index);

      expect(findings).toHaveLength(0);
    });
  });

  describe('jwt-issuance-validation', () => {
    it('detects JJWT issuance and validation', () => {
      const code = `
        package com.example.demo.security;
        import io.jsonwebtoken.Jwts;
        import io.jsonwebtoken.SignatureAlgorithm;
        import java.util.Date;

        public class JwtUtils {
          private String secret = "supersecretkey12345678901234567890";

          public String generateToken(String username) {
            return Jwts.builder()
              .setSubject(username)
              .setIssuedAt(new Date())
              .setExpiration(new Date(System.currentTimeMillis() + 3600000))
              .signWith(SignatureAlgorithm.HS256, secret)
              .compact();
          }

          public String validateAndGetUsername(String token) {
            return Jwts.parser()
              .setSigningKey(secret)
              .parseClaimsJws(token)
              .getBody()
              .getSubject();
          }
        }
      `;
      const file = parseJavaFile('src/main/java/JwtUtils.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectJwt(file, index);

      expect(findings).toHaveLength(1);
      expect(findings[0].skillSlug).toBe('jwt-issuance-validation');
      expect(findings[0].keyAttributes.isIssuance).toBe(true);
      expect(findings[0].keyAttributes.isValidation).toBe(true);
      expect(findings[0].keyAttributes.hasExpiryCheck).toBe(true);
      expect(findings[0].keyAttributes.library).toContain('io.jsonwebtoken');
    });

    it('detects Auth0 java-jwt issuance and validation', () => {
      const code = `
        package com.example.demo.security;
        import com.auth0.jwt.JWT;
        import com.auth0.jwt.algorithms.Algorithm;

        public class Auth0Service {
          public String createToken(String user) {
            return JWT.create().withSubject(user).sign(Algorithm.HMAC256("secret"));
          }
          public void verifyToken(String token) {
            JWT.require(Algorithm.HMAC256("secret")).build().verify(token);
          }
        }
      `;
      const file = parseJavaFile('src/main/java/Auth0Service.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectJwt(file, index);

      expect(findings).toHaveLength(1);
      expect(findings[0].keyAttributes.library).toContain('com.auth0');
    });

    it('rejects regular class without JWT calls', () => {
      const code = `
        public class RegularService {
          public String process(String input) { return input.toUpperCase(); }
        }
      `;
      const file = parseJavaFile('src/main/java/RegularService.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectJwt(file, index);

      expect(findings).toHaveLength(0);
    });
  });

  describe('structured-exception-handling', () => {
    it('detects @RestControllerAdvice with >=2 handlers and custom exception thrown elsewhere', () => {
      const adviceCode = `
        package com.example.demo.exception;
        import org.springframework.web.bind.annotation.*;
        import org.springframework.http.ResponseEntity;
        import org.springframework.http.HttpStatus;

        @RestControllerAdvice
        public class GlobalExceptionHandler {
          @ExceptionHandler(ResourceNotFoundException.class)
          public ResponseEntity<String> handleNotFound(ResourceNotFoundException ex) {
            return new ResponseEntity<>(ex.getMessage(), HttpStatus.NOT_FOUND);
          }

          @ExceptionHandler(IllegalArgumentException.class)
          public ResponseEntity<String> handleBadRequest(IllegalArgumentException ex) {
            return new ResponseEntity<>(ex.getMessage(), HttpStatus.BAD_REQUEST);
          }
        }
      `;
      const exceptionCode = `
        package com.example.demo.exception;

        public class ResourceNotFoundException extends RuntimeException {
          public ResourceNotFoundException(String message) {
            super(message);
          }
        }
      `;
      const serviceCode = `
        package com.example.demo.service;
        import com.example.demo.exception.ResourceNotFoundException;

        public class UserService {
          public void findUser(Long id) {
            throw new ResourceNotFoundException("Not found");
          }
        }
      `;

      const adviceFile = parseJavaFile('src/main/java/GlobalExceptionHandler.java', adviceCode);
      const excFile = parseJavaFile('src/main/java/ResourceNotFoundException.java', exceptionCode);
      const serviceFile = parseJavaFile('src/main/java/UserService.java', serviceCode);
      const index = new SymbolIndex([adviceFile, excFile, serviceFile]);

      const findings = detectExceptionHandling(adviceFile, index);
      expect(findings).toHaveLength(1);
      expect(findings[0].skillSlug).toBe('structured-exception-handling');
      expect(findings[0].keyAttributes.handlerCount).toBe(2);
      expect(findings[0].keyAttributes.customExceptionThrown).toBe('ResourceNotFoundException');
    });

    it('rejects near-miss: advice with only 1 handler', () => {
      const adviceCode = `
        package com.example.demo.exception;
        import org.springframework.web.bind.annotation.*;
        import org.springframework.http.ResponseEntity;

        @RestControllerAdvice
        public class SingleHandlerAdvice {
          @ExceptionHandler(Exception.class)
          public ResponseEntity<String> handleAny(Exception ex) {
            return ResponseEntity.internalServerError().body("error");
          }
        }
      `;
      const adviceFile = parseJavaFile('src/main/java/SingleHandlerAdvice.java', adviceCode);
      const index = new SymbolIndex([adviceFile]);
      const findings = detectExceptionHandling(adviceFile, index);

      expect(findings).toHaveLength(0);
    });

    it('rejects near-miss: 2 handlers but no custom exception thrown in repository', () => {
      const adviceCode = `
        package com.example.demo.exception;
        import org.springframework.web.bind.annotation.*;
        import org.springframework.http.ResponseEntity;

        @RestControllerAdvice
        public class NoCustomExcAdvice {
          @ExceptionHandler(NullPointerException.class)
          public ResponseEntity<String> handleNpe(NullPointerException ex) {
            return ResponseEntity.badRequest().body("npe");
          }

          @ExceptionHandler(IllegalArgumentException.class)
          public ResponseEntity<String> handleIa(IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body("ia");
          }
        }
      `;
      const adviceFile = parseJavaFile('src/main/java/NoCustomExcAdvice.java', adviceCode);
      const index = new SymbolIndex([adviceFile]);
      const findings = detectExceptionHandling(adviceFile, index);

      expect(findings).toHaveLength(0);
    });
  });

  describe('unit-tests-meaningful-assertions', () => {
    it('detects test class with >=3 test methods having meaningful assertions', () => {
      const code = `
        package com.example.demo;
        import org.junit.jupiter.api.Test;
        import static org.junit.jupiter.api.Assertions.*;

        public class CalculatorTest {
          @Test
          public void testAdd() {
            int result = 2 + 2;
            assertEquals(4, result);
          }

          @Test
          public void testSubtract() {
            int result = 5 - 2;
            assertNotEquals(0, result);
          }

          @Test
          public void testDivideByZero() {
            assertThrows(ArithmeticException.class, () -> {
              int x = 1 / 0;
            });
          }
        }
      `;
      const file = parseJavaFile('src/test/java/CalculatorTest.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectUnitTest(file, index);

      expect(findings).toHaveLength(1);
      expect(findings[0].skillSlug).toBe('unit-tests-meaningful-assertions');
      expect(findings[0].keyAttributes.qualifiedTestMethodsCount).toBe(3);
      expect(findings[0].keyAttributes.totalAssertions).toBeGreaterThanOrEqual(3);
    });

    it('rejects near-miss: fewer than 3 test methods', () => {
      const code = `
        package com.example.demo;
        import org.junit.jupiter.api.Test;
        import static org.junit.jupiter.api.Assertions.assertEquals;

        public class FewTests {
          @Test
          public void testOne() {
            assertEquals(1, 1);
          }

          @Test
          public void testTwo() {
            assertEquals(2, 2);
          }
        }
      `;
      const file = parseJavaFile('src/test/java/FewTests.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectUnitTest(file, index);

      expect(findings).toHaveLength(0);
    });

    it('rejects near-miss: tests with only trivial assertTrue(true) and assertNotNull(new Object())', () => {
      const code = `
        package com.example.demo;
        import org.junit.jupiter.api.Test;
        import static org.junit.jupiter.api.Assertions.*;

        public class TrivialTest {
          @Test
          public void testOne() {
            assertTrue(true);
          }

          @Test
          public void testTwo() {
            assertNotNull(new Object());
          }

          @Test
          public void testThree() {
            assertEquals(10, 10);
          }
        }
      `;
      const file = parseJavaFile('src/test/java/TrivialTest.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectUnitTest(file, index);

      // Only testThree has a non-trivial assertion; 1 < 3
      expect(findings).toHaveLength(0);
    });

    it('rejects disabled tests when counting qualifying methods', () => {
      const code = `
        package com.example.demo;
        import org.junit.jupiter.api.Test;
        import org.junit.jupiter.api.Disabled;
        import static org.junit.jupiter.api.Assertions.assertEquals;

        public class DisabledTest {
          @Test
          public void test1() { assertEquals(1, 1); }

          @Test
          public void test2() { assertEquals(2, 2); }

          @Test
          @Disabled
          public void test3() { assertEquals(3, 3); }
        }
      `;
      const file = parseJavaFile('src/test/java/DisabledTest.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectUnitTest(file, index);

      expect(findings).toHaveLength(0);
    });
  });

  describe('transaction-management', () => {
    it('detects @Transactional service with database write operations', () => {
      const code = `
        package com.example.demo.service;
        import org.springframework.stereotype.Service;
        import org.springframework.transaction.annotation.Transactional;

        @Service
        @Transactional
        public class OrderService {
          private OrderRepository repo;

          public void placeOrder(Order order) {
            repo.save(order);
          }
        }
      `;
      const file = parseJavaFile('src/main/java/OrderService.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectTransaction(file, index);

      expect(findings).toHaveLength(1);
      expect(findings[0].skillSlug).toBe('transaction-management');
      expect(findings[0].keyAttributes.hasWrite).toBe(true);
      expect(findings[0].keyAttributes.className).toBe('OrderService');
    });

    it('rejects @Transactional when placed directly on a @RestController', () => {
      const code = `
        package com.example.demo.controller;
        import org.springframework.web.bind.annotation.RestController;
        import org.springframework.transaction.annotation.Transactional;

        @RestController
        @Transactional
        public class BadController {
          public void doSomething() {
            repo.save(new Object());
          }
        }
      `;
      const file = parseJavaFile('src/main/java/BadController.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectTransaction(file, index);

      expect(findings).toHaveLength(0);
    });

    it('rejects @Transactional method with no persistence operations', () => {
      const code = `
        package com.example.demo.service;
        import org.springframework.stereotype.Service;
        import org.springframework.transaction.annotation.Transactional;

        @Service
        public class ComputeService {
          @Transactional
          public int calculate(int a, int b) {
            return a + b;
          }
        }
      `;
      const file = parseJavaFile('src/main/java/ComputeService.java', code);
      const index = new SymbolIndex([file]);
      const findings = detectTransaction(file, index);

      expect(findings).toHaveLength(0);
    });
  });

  describe('input-validation', () => {
    it('detects Bean Validation constraints on model enforced via @Valid parameter in controller', () => {
      const dtoCode = `
        package com.example.demo.dto;
        import jakarta.validation.constraints.*;

        public class CreateUserRequest {
          @NotBlank
          private String username;

          @NotNull
          @Min(18)
          private Integer age;

          @Email
          private String email;
        }
      `;
      const controllerCode = `
        package com.example.demo.controller;
        import org.springframework.web.bind.annotation.*;
        import jakarta.validation.Valid;
        import com.example.demo.dto.CreateUserRequest;

        @RestController
        public class UserController {
          @PostMapping("/api/users")
          public String create(@Valid @RequestBody CreateUserRequest request) {
            return "created";
          }
        }
      `;

      const dtoFile = parseJavaFile('src/main/java/CreateUserRequest.java', dtoCode);
      const controllerFile = parseJavaFile('src/main/java/UserController.java', controllerCode);
      const index = new SymbolIndex([dtoFile, controllerFile]);

      const findings = detectInputValidation(dtoFile, index);
      expect(findings).toHaveLength(1);
      expect(findings[0].skillSlug).toBe('input-validation');
      expect(findings[0].keyAttributes.constraints).toContain('NotBlank');
      expect(findings[0].keyAttributes.constraints).toContain('NotNull');
      expect(findings[0].keyAttributes.enforcedAt).toContain('UserController.create');
    });

    it('rejects DTO with constraints that is never enforced with @Valid or Validator', () => {
      const dtoCode = `
        package com.example.demo.dto;
        import jakarta.validation.constraints.NotNull;

        public class UnvalidatedDto {
          @NotNull
          private String name;
        }
      `;
      const dtoFile = parseJavaFile('src/main/java/UnvalidatedDto.java', dtoCode);
      const index = new SymbolIndex([dtoFile]);

      const findings = detectInputValidation(dtoFile, index);
      expect(findings).toHaveLength(0);
    });
  });
});
