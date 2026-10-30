import { AssessmentQuestion, IAssessmentQuestion } from '../models/AssessmentQuestion.js';
import { logger } from '../middleware/pinoLogger.js';

export const CANONICAL_QUESTIONS: Partial<IAssessmentQuestion>[] = [
  // ==========================================
  // 1. rest-controller-design (6 Questions)
  // ==========================================
  {
    questionId: 'Q_REST_01',
    skillSlug: 'rest-controller-design',
    title: 'Resource Creation HTTP Status and Headers',
    scenario: 'You are implementing an endpoint in a Spring Boot REST service to register a new User resource. The client sends a valid JSON payload. According to REST standards and Spring MVC best practices, what should the controller return upon successful creation?',
    codeSnippet: `@PostMapping("/api/users")
public ResponseEntity<?> createUser(@Valid @RequestBody CreateUserRequest request) {
    User created = userService.create(request);
    // Which response construction is correct?
}`,
    options: [
      'Return 200 OK with the created entity body.',
      'Return 201 Created with a Location header pointing to /api/users/{id} and the created representation in the body.',
      'Return 204 No Content with a Location header.',
      'Return 302 Found redirecting to the user login page.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'RFC 9110 specifies that POST requests resulting in the creation of a resource must return HTTP 201 Created along with a Location header containing the URI of the newly created resource.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_REST_02',
    skillSlug: 'rest-controller-design',
    title: 'Idempotency and HTTP Verb Semantics',
    scenario: 'An API client wants to update an existing customer email address without altering the rest of the profile fields. Which HTTP method and controller structure should be used to adhere to REST specifications?',
    codeSnippet: `// Option design choice for updating only the email field`,
    options: [
      'Use POST to /api/customers/{id}/update-email, because POST is universal for any modification.',
      'Use PUT to /api/customers/{id} sending only { "email": "new@example.com" }, letting the server clear the remaining fields.',
      'Use PATCH to /api/customers/{id} with the partial payload, because PATCH is defined for partial resource updates.',
      'Use GET to /api/customers/{id}?email=new@example.com for rapid execution.',
    ],
    correctOptionIndex: 2,
    rubricExplanation: 'PUT represents complete replacement of the target resource representation. For partial updates where only specific fields are modified, HTTP PATCH is the standardized semantic verb.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_REST_03',
    skillSlug: 'rest-controller-design',
    title: 'Deletion Response Semantics',
    scenario: 'A REST endpoint deletes a customer record. Once the record is deleted, there is no entity body to return to the client. What is the standard HTTP status code and Spring ResponseEntity to return?',
    codeSnippet: `@DeleteMapping("/api/customers/{id}")
public ResponseEntity<Void> deleteCustomer(@PathVariable UUID id) {
    customerService.delete(id);
    return ...;
}`,
    options: [
      'return ResponseEntity.status(HttpStatus.ACCEPTED).build();',
      'return ResponseEntity.noContent().build(); (HTTP 204 No Content)',
      'return ResponseEntity.ok().body("Deleted successfully");',
      'return ResponseEntity.status(HttpStatus.RESET_CONTENT).build();',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'HTTP 204 No Content is the standard status code indicating that the server successfully fulfilled the request and that there is no additional content to send in the response payload.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_REST_04',
    skillSlug: 'rest-controller-design',
    title: 'Entity Leakage Prevention in API Contracts',
    scenario: 'In a code review, you notice an @RestController method returning a JPA @Entity directly. Why is this considered an anti-pattern in production Spring Boot services?',
    codeSnippet: `@GetMapping("/api/orders/{id}")
public Order getOrder(@PathVariable Long id) {
    return orderRepository.findById(id).orElseThrow();
}`,
    options: [
      'JPA entities cannot be converted into JSON by Jackson under any circumstances.',
      'Directly exposing entities couples the persistence schema to the public API contract, risks serializing sensitive fields (e.g. passwords/internal flags), and triggers LazyInitializationExceptions during JSON serialization.',
      'Spring Boot automatically disables Hibernate caching when entities are passed to controllers.',
      'Returning entities causes HTTP 500 errors because controllers must return String or byte arrays only.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Exposing JPA entities directly leaks internal database representations, risks exposing private database columns, creates tight coupling, and frequently causes LazyInitializationException when Jackson navigates uninitialized proxy relationships.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_REST_05',
    skillSlug: 'rest-controller-design',
    title: 'Filtering vs Resource Identity in URL Design',
    scenario: 'A developer needs to design endpoints for (1) getting a specific employee by badge number, and (2) getting all active employees in department "ENGINEERING" sorted by hire date. Which URL design adheres to REST URI conventions?',
    options: [
      '(1) /api/employees?id={badgeNumber} and (2) /api/employees/dept/ENGINEERING/active/hireDate',
      '(1) /api/employees/{badgeNumber} and (2) /api/employees?department=ENGINEERING&status=ACTIVE&sort=hireDate',
      '(1) /api/getEmployee/{badgeNumber} and (2) /api/listEmployees?dept=ENGINEERING',
      '(1) /api/employees/{badgeNumber} and (2) /api/employees/{department}/{status}',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Path variables represent resource hierarchy and identity (/api/employees/{id}). Query parameters are used for filtering, sorting, pagination, and projection (/api/employees?department=X&status=Y).',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_REST_06',
    skillSlug: 'rest-controller-design',
    title: 'Handling Missing Resources and Idempotent GET',
    scenario: 'When a client requests GET /api/products/9999 and product 9999 does not exist in the database, what should the controller return?',
    options: [
      'Return 200 OK with an empty JSON object: {}',
      'Return 404 Not Found with a structured ProblemDetails or error response.',
      'Return 500 Internal Server Error indicating a database query returned null.',
      'Return 204 No Content with no body.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'HTTP 404 Not Found is the designated status code when the origin server did not find a current representation for the target resource.',
    difficulty: 'EASY',
  },

  // ==========================================
  // 2. jpa-hibernate-persistence (6 Questions)
  // ==========================================
  {
    questionId: 'Q_JPA_01',
    skillSlug: 'jpa-hibernate-persistence',
    title: 'Resolving the N+1 Select Problem',
    scenario: 'You have a User entity with a @OneToMany relationship to Order entities. When calling findAll(), Hibernate issues 1 select for users followed by 100 individual select queries for orders. How do you resolve this with Spring Data JPA?',
    codeSnippet: `// Current repository method triggering N+1 selects:
List<User> findAll();`,
    options: [
      'Change fetch type on Order to FetchType.EAGER in the entity definition.',
      'Use a JPQL query with JOIN FETCH (or @EntityGraph(attributePaths = {"orders"})) to load users and their orders in a single SQL query.',
      'Wrap the call in a while loop and query orders individually.',
      'Annotate the entity with @Transactional(readOnly = false).',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Changing to FetchType.EAGER does not prevent N+1 queries when using JPQL/findAll. The correct solution is using JOIN FETCH in JPQL or declaring @EntityGraph to instruct Hibernate to perform an SQL outer join in a single query.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_JPA_02',
    skillSlug: 'jpa-hibernate-persistence',
    title: 'LazyInitializationException in Detached Entities',
    scenario: 'A service fetches a Department entity with a LAZY collection of employees, finishes the @Transactional method, and returns the entity to the web tier. When the serializer accesses department.getEmployees(), a LazyInitializationException is thrown. What is the fundamental cause?',
    options: [
      'The database connection pool was exhausted.',
      'The Hibernate Session (Persistence Context) was closed when the transaction ended, so the uninitialized lazy proxy could no longer connect to the database to load the collection.',
      'Hibernate requires all collections to be java.util.Vector rather than List.',
      'Spring Boot does not support collections inside JPA entities.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Lazy collections are replaced with Hibernate proxy collections. If accessed after the Persistence Context closes (transaction boundary ends), the proxy has no active session to execute the query and throws LazyInitializationException.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_JPA_03',
    skillSlug: 'jpa-hibernate-persistence',
    title: 'Orphan Removal vs CascadeType.REMOVE',
    scenario: 'You have an Order entity with a list of OrderItem entities. You want items to be deleted from the database if they are removed from the order.getItems() list. Which annotation configuration achieves this?',
    codeSnippet: `@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
private List<OrderItem> items = new ArrayList<>();`,
    options: [
      'CascadeType.REMOVE alone without orphanRemoval.',
      'orphanRemoval = true (which deletes child rows when severed from parent collection or when parent is deleted).',
      'Setting fetch = FetchType.LAZY.',
      'Using @OnDelete(action = OnDeleteAction.NO_ACTION).',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'CascadeType.REMOVE only triggers child deletion when the parent itself is deleted. orphanRemoval = true additionally triggers deletion if a child is simply removed from the parent collection.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_JPA_04',
    skillSlug: 'jpa-hibernate-persistence',
    title: 'Dirty Checking vs Redundant save()',
    scenario: 'Inside an active @Transactional method, a service retrieves an existing User entity and mutates its email field. What happens if user modern practices are followed regarding repository.save()?',
    codeSnippet: `@Transactional
public void updateEmail(Long userId, String newEmail) {
    User user = userRepository.findById(userId).orElseThrow();
    user.setEmail(newEmail);
    // Is userRepository.save(user) required?
}`,
    options: [
      'userRepository.save(user) is strictly required; otherwise Hibernate discards changes on commit.',
      'userRepository.save(user) is redundant because Hibernate automatically tracks mutations on managed entities via dirty checking and flushes SQL UPDATE upon transaction commit.',
      'Hibernate throws an OptimisticLockException if save() is not called.',
      'The entity will only be updated if user.flush() is called explicitly.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Entities fetched within an active transaction are in the MANAGED state. Hibernate persistence context automatically detects changes via dirty checking and synchronizes them to the database at flush/commit time.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_JPA_05',
    skillSlug: 'jpa-hibernate-persistence',
    title: 'Optimistic Locking with @Version',
    scenario: 'Two concurrent transactions read Account entity #101 with balance $500. Both withdraw $100 and write back. How does JPA prevent the lost update anomaly using optimistic locking?',
    options: [
      'By acquiring an exclusive SELECT FOR UPDATE database lock on every read.',
      'By including a @Version numeric or timestamp column in the entity; Hibernate includes the version in the WHERE clause on UPDATE and throws OptimisticLockException if the version has changed.',
      'By serializing all incoming HTTP requests in a single thread.',
      'By storing previous entity states in a temporary Redis cache.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Optimistic locking uses a @Version column. Hibernate generates: UPDATE account SET balance = ?, version = version + 1 WHERE id = ? AND version = ?. If rows updated = 0, another transaction committed first, triggering OptimisticLockException.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_JPA_06',
    skillSlug: 'jpa-hibernate-persistence',
    title: 'Spring Data JPA Pagination with Derived Queries',
    scenario: 'You need to retrieve active products sorted by price ascending, paginated with page size 20. How should the Spring Data repository method signature look?',
    options: [
      'List<Product> findByActive(boolean active, int offset, int limit);',
      'Page<Product> findByActiveTrue(Pageable pageable);',
      'Product[] findByActive(boolean active);',
      'Iterator<Product> findByActive(boolean active, Page page);',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Spring Data JPA provides native pagination support by accepting a Pageable argument and returning a Page<T> or Slice<T> containing total elements, page numbers, and slice data.',
    difficulty: 'EASY',
  },

  // ==========================================
  // 3. spring-security-configuration (6 Questions)
  // ==========================================
  {
    questionId: 'Q_SEC_01',
    skillSlug: 'spring-security-configuration',
    title: 'SecurityFilterChain Ordering and Filter Placement',
    scenario: 'You are writing a custom JwtAuthenticationFilter in Spring Security 6. Where in the security filter chain should this filter be inserted to intercept bearer tokens before Spring checks authentication?',
    codeSnippet: `http.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);`,
    options: [
      'addFilterAfter(jwtAuthFilter, FilterSecurityInterceptor.class)',
      'addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)',
      'addFilterAfter(jwtAuthFilter, ExceptionTranslationFilter.class)',
      'It does not matter because Spring Security runs filters concurrently.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'A custom token authentication filter must run before UsernamePasswordAuthenticationFilter so it can parse credentials, validate the token, and populate the SecurityContextHolder before downstream authorization filters run.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_SEC_02',
    skillSlug: 'spring-security-configuration',
    title: 'CSRF Protection in Stateless REST APIs',
    scenario: 'In a stateless REST API where clients authenticate exclusively via HTTP Authorization: Bearer <jwt> headers without session cookies, why is disabling CSRF (.csrf(csrf -> csrf.disable())) acceptable and standard practice?',
    options: [
      'CSRF vulnerabilities only affect Windows operating systems.',
      'CSRF attacks rely on browsers automatically attaching session cookies on cross-origin requests. Because Bearer tokens are stored in memory or non-cookie storage and explicitly sent by script, browsers do not attach them automatically.',
      'Disabling CSRF doubles the throughput of AES encryption algorithms.',
      'Spring Security automatically enables OAuth2 when CSRF is disabled.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'CSRF occurs when a browser automatically submits ambient authentication credentials (cookies / basic auth headers) with cross-origin requests. Custom Authorization headers cannot be automatically attached by cross-site forms.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_SEC_03',
    skillSlug: 'spring-security-configuration',
    title: 'Method-Level Security Annotation Precedence',
    scenario: 'You want to restrict a service method so only users with the "ADMIN" role or users whose principal ID matches the target account ID can invoke it. How do you configure this in modern Spring Security?',
    codeSnippet: `@PreAuthorize("hasRole('ADMIN') or #accountId == authentication.principal.id")
public void modifyAccount(Long accountId, AccountUpdateRequest req) { ... }`,
    options: [
      '@RolesAllowed("ALL")',
      '@PreAuthorize with SpEL expression, enabled via @EnableMethodSecurity on a configuration class.',
      '@Secured("ADMIN_OR_OWNER")',
      '@Transactional(isolation = Isolation.SERIALIZABLE)',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Spring Security supports rich SpEL expressions via @PreAuthorize, which must be activated by placing @EnableMethodSecurity (formerly @EnableGlobalMethodSecurity) on a security configuration class.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_SEC_04',
    skillSlug: 'spring-security-configuration',
    title: 'Configuring Stateless Session Creation Policy',
    scenario: 'How do you configure Spring Security to guarantee that no HttpSession is ever created or used to store the SecurityContext in a stateless microservice?',
    options: [
      'http.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))',
      'http.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.ALWAYS))',
      'server.servlet.session.timeout=0 in application.properties',
      'http.logout(l -> l.deleteCookies("JSESSIONID"))',
    ],
    correctOptionIndex: 0,
    rubricExplanation: 'SessionCreationPolicy.STATELESS instructs Spring Security that it will never create an HttpSession and will never use it to obtain the SecurityContext.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_SEC_05',
    skillSlug: 'spring-security-configuration',
    title: 'CORS Preflight OPTIONS Requests Handling',
    scenario: 'A React frontend running on port 5173 calls a Spring Boot backend on port 8080 with a custom header. The browser sends an HTTP OPTIONS pre-flight request, but the backend returns 401 Unauthorized. What is the cause?',
    options: [
      'The React app forgot to compile its TypeScript files.',
      'The Spring Security configuration does not configure a CorsConfigurationSource or permits OPTIONS requests before requiring authentication.',
      'CORS is not supported over HTTP localhost connections.',
      'The database user lacks GRANT SELECT permissions.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'CORS pre-flight OPTIONS requests do not carry credentials. Spring Security must be configured with http.cors(Customizer.withDefaults()) and a CorsConfigurationSource allowing the origin, or permitAll for OPTIONS requests.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_SEC_06',
    skillSlug: 'spring-security-configuration',
    title: 'Password Hashing Best Practice',
    scenario: 'Which PasswordEncoder implementation is recommended by Spring Security for storing user credentials securely against brute-force and rainbow table attacks?',
    options: [
      'NoOpPasswordEncoder (plain text)',
      'MessageDigestPasswordEncoder with MD5',
      'BCryptPasswordEncoder (or Argon2PasswordEncoder / SCryptPasswordEncoder)',
      'Base64PasswordEncoder',
    ],
    correctOptionIndex: 2,
    rubricExplanation: 'BCrypt, Argon2, and SCrypt are adaptive, salted, slow cryptographic hashing functions designed specifically to resist hardware-accelerated GPU brute force attacks.',
    difficulty: 'EASY',
  },

  // ==========================================
  // 4. jwt-issuance-validation (6 Questions)
  // ==========================================
  {
    questionId: 'Q_JWT_01',
    skillSlug: 'jwt-issuance-validation',
    title: 'Signature Verification and Algorithm Confusion',
    scenario: 'When parsing an incoming JWT token, an application reads the header alg: none or uses an asymmetric public key with an HMAC parser. What is the correct way to validate a JWT to prevent signature tampering?',
    options: [
      'Base64 decode the payload directly and trust the sub claim if exp is in the future.',
      'Always verify the cryptographic signature using a pre-configured, trusted key and explicitly restrict expected signing algorithms before trusting any claims.',
      'Send the token in an email to the user for confirmation.',
      'Check that the token string length is greater than 128 characters.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Never trust JWT claims without verifying the signature against a trusted secret or public key with fixed algorithm restrictions to prevent "alg: none" and RSA-to-HMAC algorithm confusion attacks.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_JWT_02',
    skillSlug: 'jwt-issuance-validation',
    title: 'Clock Skew and Token Expiration Handling',
    scenario: 'Distributed servers may experience slight clock drift (e.g. 5-10 seconds difference). How should JWT validation libraries handle token expiration (exp) and issued-at (iat) checks?',
    options: [
      'Reject tokens immediately if the server clock differs by even 1 millisecond.',
      'Configure a small clock skew tolerance (e.g. 30 to 60 seconds) during claims validation to avoid rejecting valid tokens due to minor server clock drifts.',
      'Ignore the exp claim completely and rely on client local storage.',
      'Set the token expiration to 10 years to eliminate drift issues.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Standard JWT validators (such as jjwt or Nimbus JOSE) allow setting a clock skew margin (e.g. setAllowedClockSkewSeconds(60)) to prevent intermittent failures from server time desynchronization.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_JWT_03',
    skillSlug: 'jwt-issuance-validation',
    title: 'Access Token vs Refresh Token Lifespans',
    scenario: 'What is the security rationale for pairing a short-lived Access Token (e.g. 15 minutes) with a long-lived Refresh Token (e.g. 7 days) stored securely?',
    options: [
      'Short-lived access tokens reduce the window of opportunity if a token is intercepted, while refresh tokens allow obtaining new credentials without forcing the user to re-enter their password.',
      'Short tokens use less RAM in the JVM.',
      'JWT tokens cannot legally exceed 15 minutes under RFC 7519.',
      'It is solely to generate more database traffic.',
    ],
    correctOptionIndex: 0,
    rubricExplanation: 'Access tokens cannot easily be revoked without central blacklisting. Keeping access tokens short-lived limits exposure if stolen, while refresh tokens (kept in secure HttpOnly cookies) allow session renewal.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_JWT_04',
    skillSlug: 'jwt-issuance-validation',
    title: 'Confidential Data in JWT Claims',
    scenario: 'A developer stores a user database password and social security number in the JWT claims payload, claiming "it is encrypted because it is a JWT". Why is this critically flawed?',
    options: [
      'Standard JWTs (JWS) are digitally signed and Base64Url-encoded, NOT encrypted. Anyone who inspects the token can trivially decode and read all payload claims in plain text.',
      'Jackson parser cannot serialize numbers into JWTs.',
      'JWT payloads can only hold up to 16 bytes of data.',
      'Database passwords must be stored in HTTP headers instead.',
    ],
    correctOptionIndex: 0,
    rubricExplanation: 'Standard JSON Web Signatures (JWS) provide tamper-evidence (integrity and authenticity), not confidentiality. The payload is standard Base64Url-encoded JSON and readable by anyone.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_JWT_05',
    skillSlug: 'jwt-issuance-validation',
    title: 'Authorization Header Format & Parsing',
    scenario: 'An incoming request contains the header: Authorization: Bearer eyJhbGciOi.... How should a Spring Security filter extract the raw token?',
    options: [
      'request.getHeader("Authorization").substring(0, 6)',
      'Check if header != null and startsWith("Bearer "), then extract substring(7).trim()',
      'Split the entire HTTP request body by whitespace.',
      'Read the cookie named "Authorization".',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'The standard RFC 6750 Bearer authentication scheme uses the "Bearer " prefix (7 characters including trailing space). Robust parsers check non-null, prefix match, and slice from index 7.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_JWT_06',
    skillSlug: 'jwt-issuance-validation',
    title: 'Immediate Token Revocation Strategy',
    scenario: 'A user reports their device stolen. The system needs to immediately invalidate the user active JWT access tokens before they expire in 15 minutes. What architecture supports this?',
    options: [
      'Changing the user email in the database automatically cancels signed tokens.',
      'A token blacklist / revocation store (e.g. in Redis) checking the token unique jti claim or user tokensIssuedBefore timestamp on each authenticated request.',
      'Restarting the web browser on the client machine.',
      'It is theoretically impossible to invalidate a signed token under any circumstances.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Because JWT verification is stateless, immediate revocation requires either maintaining a distributed blacklist of revoked jti (JWT ID) claims or checking a tokensIssuedBefore timestamp against the iat claim.',
    difficulty: 'INTERMEDIATE',
  },

  // ==========================================
  // 5. structured-exception-handling (6 Questions)
  // ==========================================
  {
    questionId: 'Q_EXC_01',
    skillSlug: 'structured-exception-handling',
    title: 'Centralized Exception Handling with @RestControllerAdvice',
    scenario: 'Instead of repetitive try-catch blocks in every controller method, what Spring architectural pattern provides centralized, declarative exception translation across all controllers?',
    options: [
      'Writing an interceptor that catches Throwable in preHandle().',
      'Annotating a class with @RestControllerAdvice and declaring @ExceptionHandler methods returning structured response entities.',
      'Configuring server.error.include-stacktrace=always in application.properties.',
      'Catching exceptions inside the Mongoose database driver.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: '@RestControllerAdvice combined with @ExceptionHandler methods allows global interception and translation of domain and validation exceptions into standardized HTTP error responses.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_EXC_02',
    skillSlug: 'structured-exception-handling',
    title: 'RFC 7807 Problem Details Standard',
    scenario: 'Modern Spring Boot 3 applications adopt the RFC 7807 specification for API errors. What standard class does Spring provide to encapsulate type, title, status, detail, and instance URI?',
    options: [
      'org.springframework.http.ProblemDetail',
      'java.lang.ErrorPayload',
      'org.apache.catalina.connector.ResponseError',
      'javax.servlet.http.HttpErrorRecord',
    ],
    correctOptionIndex: 0,
    rubricExplanation: 'Spring Framework 6 / Spring Boot 3 introduces org.springframework.http.ProblemDetail, fully implementing RFC 7807 for standardized, machine-readable HTTP error representations.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_EXC_03',
    skillSlug: 'structured-exception-handling',
    title: 'Information Disclosure Prevention in Error Payloads',
    scenario: 'When an unexpected SQLException or NullPointerException occurs in production, what should the @ExceptionHandler(Exception.class) return to the external client?',
    options: [
      'The entire stack trace and internal database connection string so clients can debug.',
      'A generic message (e.g. "An unexpected internal error occurred") with an incident correlation ID, logging the detailed stack trace securely on the server.',
      'HTTP 200 OK with status: "failed".',
      'The raw SQL statement that failed.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Leaking internal stack traces, class names, or SQL statements to external clients violates OWASP information disclosure guidelines. Return a generic message with an incident tracking ID and log details server-side.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_EXC_04',
    skillSlug: 'structured-exception-handling',
    title: 'Validation Exception Handling (MethodArgumentNotValidException)',
    scenario: 'When an incoming request body fails @Valid annotations (e.g. @NotBlank, @Size), Spring throws MethodArgumentNotValidException. How should an @ExceptionHandler format the response for frontend consumption?',
    options: [
      'Return 500 Internal Error with the exception class name.',
      'Extract bindingResult.getFieldErrors() into a map/list of { field, message } pairs with HTTP 400 Bad Request.',
      'Ignore the errors and save null values into the database.',
      'Return 404 Not Found.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Extracting FieldErrors from the BindingResult allows returning a structured map of invalid field names to human-readable error messages, accompanied by HTTP 400 Bad Request.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_EXC_05',
    skillSlug: 'structured-exception-handling',
    title: 'Exception Handler Ordering and Specificity',
    scenario: 'A @RestControllerAdvice class defines two handlers: @ExceptionHandler(ResourceNotFoundException.class) and @ExceptionHandler(Exception.class). Which one is invoked when a ResourceNotFoundException is thrown?',
    options: [
      'The handler defined first in the Java source file always executes.',
      'Spring matches the most specific exception type in the hierarchy, so @ExceptionHandler(ResourceNotFoundException.class) will execute.',
      'Both handlers execute in parallel.',
      'Neither; Spring requires an exact match for RuntimeException.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Spring ExceptionHandlerExceptionResolver matches handlers based on closest inheritance distance in the exception hierarchy, guaranteeing that specific handlers take precedence over generic handlers.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_EXC_06',
    skillSlug: 'structured-exception-handling',
    title: 'Business Exception to HTTP Status Mapping',
    scenario: 'You create a custom InsufficientFundsException in a payment service. What is the most appropriate HTTP status code to map this domain condition to when returned by a REST API?',
    options: [
      'HTTP 404 Not Found',
      'HTTP 422 Unprocessable Entity (or 400 Bad Request with error code)',
      'HTTP 502 Bad Gateway',
      'HTTP 304 Not Modified',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'When the request syntax is valid (JSON parses properly) but semantic business rules prevent processing (insufficient funds), HTTP 422 Unprocessable Entity or HTTP 400 Bad Request is the appropriate status.',
    difficulty: 'EASY',
  },

  // ==========================================
  // 6. unit-tests-meaningful-assertions (6 Questions)
  // ==========================================
  {
    questionId: 'Q_TEST_01',
    skillSlug: 'unit-tests-meaningful-assertions',
    title: 'Meaningful State Assertions vs assertNotNull()',
    scenario: 'A developer writes a unit test for a calculateDiscount() method that only contains: assertNotNull(result);. Why is this considered an ineffective assertion?',
    options: [
      'assertNotNull() is deprecated in JUnit 5.',
      'It passes even if the calculated discount is completely incorrect (e.g. -500% or 0), verifying only that an object exists rather than correctness of business calculations.',
      'assertNotNull() slows down execution compared to assertEquals().',
      'JUnit tests must contain at least 10 assertions to compile.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Meaningful unit testing requires asserting domain invariants, specific calculated return values, or state changes. assertNotNull only checks memory reference existence.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_TEST_02',
    skillSlug: 'unit-tests-meaningful-assertions',
    title: 'Argument Captors and Side-Effect Verification',
    scenario: 'You are testing a service method that updates a user email and persists it to the database. How do you verify that the exact entity passed to userRepository.save() contains the modified email using Mockito?',
    codeSnippet: `ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
verify(userRepository).save(captor.capture());
assertEquals("new@email.com", captor.getValue().getEmail());`,
    options: [
      'By using Mockito ArgumentCaptor to capture the argument passed to save() and asserting on its properties.',
      'By checking System.out.println() output in console.',
      'By calling userRepository.findAll() directly in the unit test.',
      'By annotating the test with @DirtiesContext.',
    ],
    correctOptionIndex: 0,
    rubricExplanation: 'ArgumentCaptor allows capturing arguments passed to mocked dependencies during execution, enabling thorough verification of internal object state before persistence.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_TEST_03',
    skillSlug: 'unit-tests-meaningful-assertions',
    title: 'Testing Expected Exceptions in JUnit 5',
    scenario: 'How should you assert that transferFunds() throws an IllegalArgumentException when amount is negative in modern JUnit 5 (Jupiter)?',
    options: [
      '@Test(expected = IllegalArgumentException.class)',
      'assertThrows(IllegalArgumentException.class, () -> service.transferFunds(-50.0))',
      'Wrap in try-catch and call fail() if no exception is thrown.',
      'assertNull(service.transferFunds(-50.0))',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'JUnit 5 replaces the legacy JUnit 4 @Test(expected) with org.junit.jupiter.api.Assertions.assertThrows(), which returns the thrown exception instance for further assertion on messages or causes.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_TEST_04',
    skillSlug: 'unit-tests-meaningful-assertions',
    title: 'Deterministic Time-Dependent Testing',
    scenario: 'A service method checks if an access token is expired using Instant.now(). In unit tests, this causes flaky tests depending on execution time. How should time be managed for deterministic testing?',
    options: [
      'Put Thread.sleep(1000) before every assertion.',
      'Inject a java.time.Clock instance into the service and supply Clock.fixed() with a known Instant in the unit test.',
      'Run unit tests only at midnight UTC.',
      'Disable token expiration logic whenever running in tests.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Injecting java.time.Clock allows production code to use clock.instant() while unit tests supply Clock.fixed(instant, zone), eliminating temporal flakiness.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_TEST_05',
    skillSlug: 'unit-tests-meaningful-assertions',
    title: 'Over-Mocking Pitfall',
    scenario: 'In a unit test, a developer mocks every single helper class, private field, and collection, resulting in 40 lines of when(...).thenReturn(...) before executing 2 lines of code. What is the danger of this pattern?',
    options: [
      'The test tests the mock configuration rather than real component behavior, resulting in fragile tests that break with any internal refactoring while failing to catch real integration defects.',
      'Mockito charges license fees per mock created.',
      'Mocking more than 3 objects causes a StackOverflowError in Java 17.',
      'It violates the Java Language Specification.',
    ],
    correctOptionIndex: 0,
    rubricExplanation: 'Over-mocking ties the test directly to private implementation details rather than public observable behavior, creating brittle tests that give false confidence while inhibiting refactoring.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_TEST_06',
    skillSlug: 'unit-tests-meaningful-assertions',
    title: 'Slice Testing with @DataJpaTest',
    scenario: 'You want to test a Spring Data JPA custom repository query against an in-memory database without loading the full web environment and all @Controllers. Which slice test annotation should you use?',
    options: [
      '@SpringBootTest',
      '@WebMvcTest',
      '@DataJpaTest',
      '@RestClientTest',
    ],
    correctOptionIndex: 2,
    rubricExplanation: '@DataJpaTest focuses purely on JPA components: configures an in-memory database, scans @Entity classes, configures Spring Data JPA repositories, and runs each test inside a transaction that rolls back by default.',
    difficulty: 'EASY',
  },

  // ==========================================
  // 7. transaction-management (6 Questions)
  // ==========================================
  {
    questionId: 'Q_TX_01',
    skillSlug: 'transaction-management',
    title: 'Self-Invocation Proxy Bypass Pitfall',
    scenario: 'A service class has methodA() (unannotated) which calls this.methodB() (@Transactional). When a client calls methodA(), why is methodB() NOT executed inside a transaction?',
    codeSnippet: `public void methodA() {
    this.methodB(); // Why does this bypass @Transactional?
}
@Transactional
public void methodB() { ... }`,
    options: [
      'Spring does not allow transactions on public methods.',
      'Spring transaction management uses AOP proxies. An internal direct call (this.methodB()) bypasses the outer proxy interceptor, so transaction advice is never executed.',
      'Hibernate requires an XML configuration file to handle internal calls.',
      'Transactions only work on methods starting with "save" or "delete".',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Spring AOP wraps beans in dynamic proxies. When methodA is invoked internally via this.methodB(), the call does not pass through the proxy wrapper, bypassing transaction interceptors.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_TX_02',
    skillSlug: 'transaction-management',
    title: 'Default Rollback Behavior for Checked Exceptions',
    scenario: 'A method annotated with default @Transactional throws a checked Exception (e.g. java.io.IOException). By default in Spring, does the transaction roll back?',
    codeSnippet: `@Transactional
public void processFile() throws IOException {
    repository.save(entity);
    throw new IOException("Disk failure");
}`,
    options: [
      'Yes, Spring rolls back on any Throwable by default.',
      'No! By default, Spring transactions roll back only for unchecked exceptions (RuntimeException and Error). Checked exceptions must be explicitly declared via @Transactional(rollbackFor = Exception.class).',
      'Yes, but only if the database is PostgreSQL.',
      'It enters a suspended state indefinitely.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Under default Spring rules (EJB convention), transactions roll back on unchecked exceptions (RuntimeException) but commit on checked exceptions. Use rollbackFor = Exception.class to rollback on all exceptions.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_TX_03',
    skillSlug: 'transaction-management',
    title: 'Propagation.REQUIRES_NEW vs REQUIRED',
    scenario: 'You want an auditLogService.logAction() call to execute and commit in its own separate transaction, regardless of whether the surrounding business transaction succeeds or rolls back. Which propagation mode is required?',
    options: [
      'Propagation.REQUIRED',
      'Propagation.REQUIRES_NEW',
      'Propagation.SUPPORTS',
      'Propagation.NEVER',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Propagation.REQUIRES_NEW always suspends the current transaction (if any) and starts an independent transaction with its own connection, ensuring its commit/rollback is decoupled from the outer transaction.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_TX_04',
    skillSlug: 'transaction-management',
    title: 'External Network Calls Inside Transactions',
    scenario: 'Why is making slow external third-party HTTP API calls (e.g. payment gateway) inside a long @Transactional database method considered a dangerous performance anti-pattern?',
    options: [
      'HTTP requests crash the JVM if executed on a worker thread.',
      'It holds open an expensive database connection from the connection pool while waiting for network I/O, leading to connection pool exhaustion and blocking all other application threads.',
      'Hibernate automatically converts HTTP responses into SQL queries.',
      'It causes deadlocks in the garbage collector.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Database connections are a scarce shared resource. Holding a connection open during non-deterministic network I/O starves the connection pool (HikariCP) and degrades entire system scalability.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_TX_05',
    skillSlug: 'transaction-management',
    title: 'Read-Only Transactions Optimization',
    scenario: 'What benefits does adding @Transactional(readOnly = true) provide for query-only service methods interacting with Hibernate/JPA?',
    options: [
      'It disables the network interface on the database.',
      'Hibernate sets FlushMode.MANUAL and turns off dirty checking snapshot caching, reducing memory consumption and speeding up entity processing.',
      'It prevents other users from reading from the database.',
      'It encrypts the SQL query using RSA.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: '@Transactional(readOnly = true) allows Hibernate to optimize execution: it skips dirty checking snapshots for loaded entities, reduces memory overhead, and allows routing to read replicas.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_TX_06',
    skillSlug: 'transaction-management',
    title: 'Database Isolation Level: Non-Repeatable Reads',
    scenario: 'Which standard SQL transaction isolation level guarantees that if transaction T1 reads a row, subsequent reads of the same row within T1 will return the exact same data, even if concurrent transaction T2 commits modifications to it?',
    options: [
      'READ_UNCOMMITTED',
      'READ_COMMITTED',
      'REPEATABLE_READ',
      'AUTO_COMMIT',
    ],
    correctOptionIndex: 2,
    rubricExplanation: 'READ_COMMITTED permits non-repeatable reads (a row can be modified and committed by another transaction between reads). REPEATABLE_READ prevents non-repeatable reads by snapshot or lock isolation.',
    difficulty: 'INTERMEDIATE',
  },

  // ==========================================
  // 8. input-validation (6 Questions)
  // ==========================================
  {
    questionId: 'Q_VAL_01',
    skillSlug: 'input-validation',
    title: 'Nested DTO Validation with @Valid',
    scenario: 'You have an OrderRequest DTO containing a nested AddressDTO shippingAddress. The AddressDTO has @NotBlank on its street field. However, when an invalid request is sent, the street validation is not triggered. What is missing on the parent DTO?',
    codeSnippet: `public class OrderRequest {
    @NotNull
    private UUID customerId;
    // Missing annotation here?
    private AddressDTO shippingAddress;
}`,
    options: [
      '@Valid on the nested shippingAddress field in OrderRequest to instruct the validator to cascade into the child object.',
      '@Transient on shippingAddress.',
      '@Autowired on AddressDTO.',
      'Spring Boot automatically validates all nested objects without annotations.',
    ],
    correctOptionIndex: 0,
    rubricExplanation: 'Jakarta/Hibernate Bean Validation does not cascade validation into nested objects unless the object reference is explicitly annotated with @Valid.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_VAL_02',
    skillSlug: 'input-validation',
    title: 'Difference Between @NotNull, @NotEmpty, and @NotBlank',
    scenario: 'Which constraint annotation should you apply to a String username field if you want to reject null, empty string "", AND strings consisting solely of whitespace "   "?',
    options: [
      '@NotNull',
      '@NotEmpty',
      '@NotBlank',
      '@Size(min = 0)',
    ],
    correctOptionIndex: 2,
    rubricExplanation: '@NotNull checks obj != null. @NotEmpty checks obj != null && length > 0 (whitespace still passes). @NotBlank checks that the character sequence is not null and has at least one non-whitespace character.',
    difficulty: 'EASY',
  },
  {
    questionId: 'Q_VAL_03',
    skillSlug: 'input-validation',
    title: 'Validating Controller Path Variables and Query Parameters',
    scenario: 'You want to validate that a @PathVariable Long id is positive using @Positive(@PathVariable Long id). What annotation must be present on the controller class itself for Spring to validate method parameters?',
    codeSnippet: `@RestController
@Validated // Is this required?
public class UserController {
    @GetMapping("/users/{id}")
    public User getUser(@PathVariable @Positive Long id) { ... }
}`,
    options: [
      '@Validated at the class level to enable Spring MethodValidationPostProcessor to intercept parameter constraints.',
      '@EnableJpaRepositories at the class level.',
      '@ResponseBody on the method.',
      'No class annotation is needed because @PathVariable validates itself.',
    ],
    correctOptionIndex: 0,
    rubricExplanation: 'While @RequestBody DTO validation is handled by the HttpMessageConverter via @Valid, path variables and request parameter constraints require class-level @Validated to activate Spring AOP method validation.',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_VAL_04',
    skillSlug: 'input-validation',
    title: 'Custom ConstraintValidator Implementation',
    scenario: 'How do you create a custom reusable annotation @ValidPostalCode in Spring Boot using Jakarta Bean Validation?',
    options: [
      'Write a JavaScript regex in the frontend bundle only.',
      'Declare the @interface ValidPostalCode annotated with @Constraint(validatedBy = PostalCodeValidator.class), and implement ConstraintValidator<ValidPostalCode, String>.',
      'Create an enum containing all world postal codes.',
      'Subclass java.lang.Throwable in the service layer.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Custom constraints require an annotation marked with @Constraint pointing to a class implementing ConstraintValidator<A, T> overriding initialize() and isValid().',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_VAL_05',
    skillSlug: 'input-validation',
    title: 'Conditional Validation Groups',
    scenario: 'In an API, password is required when creating a new user (OnCreate), but optional when updating an existing user (OnUpdate). How does Bean Validation support this?',
    options: [
      'Create two completely identical database tables.',
      'Use validation groups (groups = {OnCreate.class}) on the constraint annotation and specify @Validated(OnCreate.class) in the controller endpoint.',
      'Check passwords manually using regex inside the repository layer.',
      'Validation cannot be conditionally grouped in Java.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Bean Validation provides groups support: annotations specify groups = {SomeGroup.class}, and endpoints activate them using @Validated(SomeGroup.class).',
    difficulty: 'INTERMEDIATE',
  },
  {
    questionId: 'Q_VAL_06',
    skillSlug: 'input-validation',
    title: 'Fail-Fast vs Comprehensive Error Collection',
    scenario: 'Why is it better for a REST API to collect all validation errors across all fields in a request payload rather than failing fast on the very first invalid field?',
    options: [
      'Failing fast causes the database connection pool to leak.',
      'Returning all validation errors in one response enables the client UI to highlight every invalid form field simultaneously, providing a superior developer and user experience.',
      'Spring Framework cannot legally terminate on the first error.',
      'It reduces CPU cycles on the server.',
    ],
    correctOptionIndex: 1,
    rubricExplanation: 'Returning a comprehensive list of validation violations allows the client to display all errors at once, avoiding frustrating sequential submit-and-fix iterations.',
    difficulty: 'EASY',
  },
];

export async function seedAssessmentQuestions(): Promise<void> {
  try {
    for (const q of CANONICAL_QUESTIONS) {
      await AssessmentQuestion.findOneAndUpdate(
        { questionId: q.questionId },
        { $set: q },
        { upsert: true, new: true }
      );
    }
    logger.info({ count: CANONICAL_QUESTIONS.length }, 'Successfully seeded assessment question catalog.');
  } catch (err) {
    logger.error({ err }, 'Error seeding assessment question catalog.');
  }
}
