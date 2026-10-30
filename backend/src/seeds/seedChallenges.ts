import { Challenge, IChallenge } from '../models/Challenge.js';
import { logger } from '../middleware/pinoLogger.js';

export const CANONICAL_CHALLENGES: Partial<IChallenge>[] = [
  // ==========================================
  // 1. rest-api-secure-vault
  // ==========================================
  {
    slug: 'rest-api-secure-vault',
    title: 'Secure Secret Vault REST Service',
    description: 'Implement a secure vault REST controller handling secret storage and retrieval with Bearer JWT verification, input validation, and proper HTTP response status codes.',
    mappedSkills: [
      'rest-controller-design',
      'spring-security-configuration',
      'jwt-issuance-validation',
      'input-validation',
    ],
    timeLimitMinutes: 45,
    instructions: `### Objective
Implement the \`VaultController\` REST endpoints and \`SecretRequest\` DTO to fulfill the following contract:

1. **POST /api/vault/secrets**:
   - Accepts JSON payload \`{ "name": String, "secretValue": String, "ttlSeconds": Integer }\`.
   - Validates that \`name\` is not blank (\`@NotBlank\`) and has length between 3 and 50 characters.
   - Validates that \`secretValue\` is not blank (\`@NotBlank\`).
   - Requires valid \`Authorization: Bearer <jwt>\` header.
   - On success, stores the secret in memory/repository and returns **HTTP 201 Created** with a **Location** header pointing to \`/api/vault/secrets/{id}\` and the created \`SecretResponse\` in the body.
2. **GET /api/vault/secrets/{id}**:
   - Requires valid Bearer token.
   - Returns **HTTP 200 OK** with \`SecretResponse\` if found.
   - Returns **HTTP 404 Not Found** if the secret does not exist or has expired.
3. **DELETE /api/vault/secrets/{id}**:
   - Requires valid Bearer token.
   - Returns **HTTP 204 No Content** upon successful deletion.`,
    starterFiles: [
      {
        path: 'src/main/java/com/skillproof/vault/VaultController.java',
        content: `package com.skillproof.vault;

import java.net.URI;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class VaultController {
    private final Map<String, SecretResponse> vault = new ConcurrentHashMap<>();

    // TODO: Implement createSecret with @NotBlank validation, Bearer auth check, and 201 Created
    public VaultResponse createSecret(String authHeader, SecretRequest request) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return new VaultResponse(401, "Missing or invalid Bearer token", null);
        }
        if (request.getName() == null || request.getName().trim().isEmpty() || request.getName().length() < 3) {
            return new VaultResponse(400, "Validation failed: name must be between 3 and 50 characters", null);
        }
        if (request.getSecretValue() == null || request.getSecretValue().trim().isEmpty()) {
            return new VaultResponse(400, "Validation failed: secretValue cannot be blank", null);
        }

        String id = UUID.randomUUID().toString();
        SecretResponse response = new SecretResponse(id, request.getName(), request.getSecretValue(), System.currentTimeMillis());
        vault.put(id, response);

        VaultResponse res = new VaultResponse(201, "Created", response);
        res.setLocation("/api/vault/secrets/" + id);
        return res;
    }

    // TODO: Implement getSecret returning 200 or 404
    public VaultResponse getSecret(String authHeader, String id) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return new VaultResponse(401, "Unauthorized", null);
        }
        SecretResponse secret = vault.get(id);
        if (secret == null) {
            return new VaultResponse(404, "Secret not found", null);
        }
        return new VaultResponse(200, "OK", secret);
    }

    // TODO: Implement deleteSecret returning 204 No Content
    public VaultResponse deleteSecret(String authHeader, String id) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return new VaultResponse(401, "Unauthorized", null);
        }
        vault.remove(id);
        return new VaultResponse(204, "No Content", null);
    }
}
`,
      },
      {
        path: 'src/main/java/com/skillproof/vault/SecretRequest.java',
        content: `package com.skillproof.vault;

public class SecretRequest {
    private String name;
    private String secretValue;
    private Integer ttlSeconds;

    public SecretRequest() {}
    public SecretRequest(String name, String secretValue, Integer ttlSeconds) {
        this.name = name;
        this.secretValue = secretValue;
        this.ttlSeconds = ttlSeconds;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSecretValue() { return secretValue; }
    public void setSecretValue(String secretValue) { this.secretValue = secretValue; }

    public Integer getTtlSeconds() { return ttlSeconds; }
    public void setTtlSeconds(Integer ttlSeconds) { this.ttlSeconds = ttlSeconds; }
}
`,
      },
      {
        path: 'src/main/java/com/skillproof/vault/SecretResponse.java',
        content: `package com.skillproof.vault;

public class SecretResponse {
    private String id;
    private String name;
    private String secretValue;
    private long createdAt;

    public SecretResponse(String id, String name, String secretValue, long createdAt) {
        this.id = id;
        this.name = name;
        this.secretValue = secretValue;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getSecretValue() { return secretValue; }
    public long getCreatedAt() { return createdAt; }
}
`,
      },
      {
        path: 'src/main/java/com/skillproof/vault/VaultResponse.java',
        content: `package com.skillproof.vault;

public class VaultResponse {
    private int status;
    private String message;
    private Object body;
    private String location;

    public VaultResponse(int status, String message, Object body) {
        this.status = status;
        this.message = message;
        this.body = body;
    }

    public int getStatus() { return status; }
    public String getMessage() { return message; }
    public Object getBody() { return body; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
}
`,
      },
    ],
    hiddenTestFiles: [
      {
        path: 'src/test/java/com/skillproof/vault/VaultControllerTest.java',
        content: `package com.skillproof.vault;

public class VaultControllerTest {
    public static void main(String[] args) {
        int passed = 0;
        int total = 4;
        VaultController controller = new VaultController();
        String validToken = "Bearer test.jwt.token";

        // Test 1: Rejects unauthenticated requests with 401
        VaultResponse unauth = controller.createSecret(null, new SecretRequest("key", "val", 60));
        if (unauth.getStatus() == 401) {
            System.out.println("PASS: Test 1 - Rejects unauthenticated request with 401");
            passed++;
        } else {
            System.err.println("FAIL: Test 1 - Expected 401 but got " + unauth.getStatus());
        }

        // Test 2: Validates blank input fields with 400
        VaultResponse badReq = controller.createSecret(validToken, new SecretRequest("  ", "val", 60));
        if (badReq.getStatus() == 400) {
            System.out.println("PASS: Test 2 - Rejects blank name with 400 Bad Request");
            passed++;
        } else {
            System.err.println("FAIL: Test 2 - Expected 400 but got " + badReq.getStatus());
        }

        // Test 3: Creates secret returning 201 and Location header
        VaultResponse created = controller.createSecret(validToken, new SecretRequest("database_pwd", "s3cr3t!P@ss", 3600));
        if (created.getStatus() == 201 && created.getLocation() != null && created.getLocation().startsWith("/api/vault/secrets/")) {
            System.out.println("PASS: Test 3 - Created secret returns 201 and Location header");
            passed++;
        } else {
            System.err.println("FAIL: Test 3 - Expected 201 with Location header");
        }

        // Test 4: Fetches existing secret (200) and missing secret (404)
        SecretResponse sec = (created != null && created.getBody() instanceof SecretResponse) ? (SecretResponse) created.getBody() : null;
        VaultResponse fetched = sec != null ? controller.getSecret(validToken, sec.getId()) : new VaultResponse(500, "Missing", null);
        VaultResponse missing = controller.getSecret(validToken, "non_existent_id");
        if (fetched.getStatus() == 200 && missing.getStatus() == 404) {
            System.out.println("PASS: Test 4 - Get secret returns 200 for existing and 404 for missing");
            passed++;
        } else {
            System.err.println("FAIL: Test 4 - Expected 200 and 404");
        }

        System.out.println("SKILLPROOF_TEST_SUMMARY:" + passed + "/" + total);
        if (passed < total) System.exit(1);
    }
}
`,
      },
    ],
  },

  // ==========================================
  // 2. order-persistence-engine
  // ==========================================
  {
    slug: 'order-persistence-engine',
    title: 'Transactional Order Persistence Engine',
    description: 'Implement a transactional order processing service supporting line item additions, orphan removal, optimistic locking, and rollback on unchecked exceptions.',
    mappedSkills: [
      'jpa-hibernate-persistence',
      'transaction-management',
      'structured-exception-handling',
    ],
    timeLimitMinutes: 45,
    instructions: `### Objective
Implement the \`OrderService\` and \`Order\` domain model to satisfy:

1. **Transactional Integrity & Rollback**:
   - \`placeOrder(Order order)\` must execute atomically. If any item has invalid quantity ($< 1$) or inventory fails, throw an unchecked \`IllegalArgumentException\` or \`InventoryException\` and ensure no changes persist.
2. **Orphan Removal & Item Lifecycle**:
   - When an item is removed from \`order.getItems()\`, it must be cleanly deleted from the items collection.
3. **Optimistic Locking**:
   - Each mutation must increment the \`version\` field to detect concurrent modifications.`,
    starterFiles: [
      {
        path: 'src/main/java/com/skillproof/order/OrderService.java',
        content: `package com.skillproof.order;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class OrderService {
    private final Map<String, Order> orderStore = new ConcurrentHashMap<>();

    // TODO: Process order placement with validation, atomic rollback, and versioning
    public Order placeOrder(Order order) {
        if (order.getItems() == null || order.getItems().isEmpty()) {
            throw new IllegalArgumentException("Order must contain at least one item");
        }
        for (OrderItem item : order.getItems()) {
            if (item.getQuantity() <= 0) {
                throw new IllegalArgumentException("Item quantity must be positive");
            }
        }
        order.setStatus("PLACED");
        order.setVersion(order.getVersion() + 1);
        orderStore.put(order.getId(), order);
        return order;
    }

    public Order updateOrderItems(String orderId, List<OrderItem> newItems, long expectedVersion) {
        Order order = orderStore.get(orderId);
        if (order == null) {
            throw new NoSuchElementException("Order not found: " + orderId);
        }
        if (order.getVersion() != expectedVersion) {
            throw new IllegalStateException("OptimisticLockException: Concurrent update detected");
        }
        order.setItems(new ArrayList<>(newItems));
        order.setVersion(order.getVersion() + 1);
        return order;
    }

    public Order getOrder(String orderId) {
        return orderStore.get(orderId);
    }
}
`,
      },
      {
        path: 'src/main/java/com/skillproof/order/Order.java',
        content: `package com.skillproof.order;

import java.util.*;

public class Order {
    private String id;
    private String customerId;
    private String status;
    private long version;
    private List<OrderItem> items = new ArrayList<>();

    public Order(String id, String customerId) {
        this.id = id;
        this.customerId = customerId;
        this.status = "DRAFT";
        this.version = 0;
    }

    public String getId() { return id; }
    public String getCustomerId() { return customerId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
    public List<OrderItem> getItems() { return items; }
    public void setItems(List<OrderItem> items) { this.items = items; }
    public void addItem(OrderItem item) { this.items.add(item); }
}
`,
      },
      {
        path: 'src/main/java/com/skillproof/order/OrderItem.java',
        content: `package com.skillproof.order;

public class OrderItem {
    private String productId;
    private int quantity;
    private double unitPrice;

    public OrderItem(String productId, int quantity, double unitPrice) {
        this.productId = productId;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    public String getProductId() { return productId; }
    public int getQuantity() { return quantity; }
    public double getUnitPrice() { return unitPrice; }
}
`,
      },
    ],
    hiddenTestFiles: [
      {
        path: 'src/test/java/com/skillproof/order/OrderServiceTest.java',
        content: `package com.skillproof.order;

import java.util.*;

public class OrderServiceTest {
    public static void main(String[] args) {
        int passed = 0;
        int total = 3;
        OrderService service = new OrderService();

        // Test 1: Place valid order increments version to 1
        Order order = new Order("ord_101", "cust_99");
        order.addItem(new OrderItem("prod_A", 2, 49.99));
        Order placed = service.placeOrder(order);
        if (placed.getVersion() == 1 && "PLACED".equals(placed.getStatus())) {
            System.out.println("PASS: Test 1 - Order successfully placed with version incremented");
            passed++;
        } else {
            System.err.println("FAIL: Test 1 - Failed version or status");
        }

        // Test 2: Throws IllegalArgumentException on invalid quantity <= 0 (atomic rollback)
        Order invalidOrder = new Order("ord_102", "cust_99");
        invalidOrder.addItem(new OrderItem("prod_B", 0, 19.99));
        try {
            service.placeOrder(invalidOrder);
            System.err.println("FAIL: Test 2 - Expected IllegalArgumentException not thrown");
        } catch (IllegalArgumentException ex) {
            System.out.println("PASS: Test 2 - Rejected invalid item quantity with rollback");
            passed++;
        }

        // Test 3: Optimistic locking rejects stale version update
        try {
            service.updateOrderItems("ord_101", List.of(new OrderItem("prod_A", 3, 49.99)), 999L);
            System.err.println("FAIL: Test 3 - Expected OptimisticLockException not thrown");
        } catch (IllegalStateException ex) {
            System.out.println("PASS: Test 3 - Optimistic locking successfully prevented stale update");
            passed++;
        }

        System.out.println("SKILLPROOF_TEST_SUMMARY:" + passed + "/" + total);
        if (passed < total) System.exit(1);
    }
}
`,
      },
    ],
  },

  // ==========================================
  // 3. enterprise-account-service
  // ==========================================
  {
    slug: 'enterprise-account-service',
    title: 'Enterprise Multi-Tier Account Balance Service',
    description: 'Implement an enterprise banking transfer service enforcing ACID balance transfer invariants, constraint validation, and RESTful query responses.',
    mappedSkills: [
      'rest-controller-design',
      'jpa-hibernate-persistence',
      'transaction-management',
      'input-validation',
    ],
    timeLimitMinutes: 45,
    instructions: `### Objective
Implement the \`AccountService\` to handle fund transfers between accounts satisfying strict transactional integrity:

1. **Constraint Validation**:
   - Transfer amount must be positive ($> 0.00$).
   - Sender and recipient account IDs cannot be null or identical.
2. **ACID Transaction Semantics**:
   - The transfer operation must debit the source and credit the target atomically.
   - If the source balance is insufficient, throw \`InsufficientFundsException\` and ensure neither balance is modified.
3. **Optimistic Locking**:
   - Increments both account versions upon successful completion.`,
    starterFiles: [
      {
        path: 'src/main/java/com/skillproof/account/AccountService.java',
        content: `package com.skillproof.account;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class AccountService {
    private final Map<String, Account> accounts = new ConcurrentHashMap<>();

    public void createAccount(String id, double initialBalance) {
        accounts.put(id, new Account(id, initialBalance));
    }

    public Account getAccount(String id) {
        return accounts.get(id);
    }

    // TODO: Implement transferFunds with atomic debit/credit, validation, and insufficient funds exception
    public synchronized void transferFunds(TransferRequest request) {
        if (request.getAmount() <= 0) {
            throw new IllegalArgumentException("Transfer amount must be strictly positive");
        }
        if (request.getFromAccountId() == null || request.getToAccountId() == null) {
            throw new IllegalArgumentException("Account IDs cannot be null");
        }
        if (request.getFromAccountId().equals(request.getToAccountId())) {
            throw new IllegalArgumentException("Source and destination accounts must be distinct");
        }

        Account from = accounts.get(request.getFromAccountId());
        Account to = accounts.get(request.getToAccountId());

        if (from == null || to == null) {
            throw new NoSuchElementException("Account not found");
        }

        if (from.getBalance() < request.getAmount()) {
            throw new IllegalStateException("Insufficient funds in account: " + from.getId());
        }

        from.setBalance(from.getBalance() - request.getAmount());
        from.setVersion(from.getVersion() + 1);

        to.setBalance(to.getBalance() + request.getAmount());
        to.setVersion(to.getVersion() + 1);
    }
}
`,
      },
      {
        path: 'src/main/java/com/skillproof/account/TransferRequest.java',
        content: `package com.skillproof.account;

public class TransferRequest {
    private String fromAccountId;
    private String toAccountId;
    private double amount;

    public TransferRequest(String fromAccountId, String toAccountId, double amount) {
        this.fromAccountId = fromAccountId;
        this.toAccountId = toAccountId;
        this.amount = amount;
    }

    public String getFromAccountId() { return fromAccountId; }
    public String getToAccountId() { return toAccountId; }
    public double getAmount() { return amount; }
}
`,
      },
      {
        path: 'src/main/java/com/skillproof/account/Account.java',
        content: `package com.skillproof.account;

public class Account {
    private String id;
    private double balance;
    private long version;

    public Account(String id, double balance) {
        this.id = id;
        this.balance = balance;
        this.version = 0;
    }

    public String getId() { return id; }
    public double getBalance() { return balance; }
    public void setBalance(double balance) { this.balance = balance; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
}
`,
      },
    ],
    hiddenTestFiles: [
      {
        path: 'src/test/java/com/skillproof/account/AccountServiceTest.java',
        content: `package com.skillproof.account;

public class AccountServiceTest {
    public static void main(String[] args) {
        int passed = 0;
        int total = 3;
        AccountService service = new AccountService();
        service.createAccount("acc_A", 500.0);
        service.createAccount("acc_B", 200.0);

        // Test 1: Successful atomic transfer
        service.transferFunds(new TransferRequest("acc_A", "acc_B", 150.0));
        Account a = service.getAccount("acc_A");
        Account b = service.getAccount("acc_B");
        if (Math.abs(a.getBalance() - 350.0) < 0.01 && Math.abs(b.getBalance() - 350.0) < 0.01 && a.getVersion() == 1) {
            System.out.println("PASS: Test 1 - Funds transferred atomically between accounts");
            passed++;
        } else {
            System.err.println("FAIL: Test 1 - Balances mismatch: A=" + a.getBalance() + ", B=" + b.getBalance());
        }

        // Test 2: Rejects insufficient balance with rollback (no change in balance)
        try {
            service.transferFunds(new TransferRequest("acc_A", "acc_B", 1000.0));
            System.err.println("FAIL: Test 2 - Expected IllegalStateException not thrown");
        } catch (IllegalStateException ex) {
            if (Math.abs(service.getAccount("acc_A").getBalance() - 350.0) < 0.01) {
                System.out.println("PASS: Test 2 - Prevented overdraft and maintained balance invariants");
                passed++;
            } else {
                System.err.println("FAIL: Test 2 - Balance was corrupted on failed transfer");
            }
        }

        // Test 3: Rejects transfer to same account
        try {
            service.transferFunds(new TransferRequest("acc_A", "acc_A", 50.0));
            System.err.println("FAIL: Test 3 - Expected IllegalArgumentException for same account");
        } catch (IllegalArgumentException ex) {
            System.out.println("PASS: Test 3 - Rejected transfer to self");
            passed++;
        }

        System.out.println("SKILLPROOF_TEST_SUMMARY:" + passed + "/" + total);
        if (passed < total) System.exit(1);
    }
}
`,
      },
    ],
  },
];

export async function seedChallenges(): Promise<void> {
  try {
    for (const c of CANONICAL_CHALLENGES) {
      await Challenge.findOneAndUpdate(
        { slug: c.slug },
        { $set: c },
        { upsert: true, new: true }
      );
    }
    logger.info({ count: CANONICAL_CHALLENGES.length }, 'Successfully seeded practical challenges catalog.');
  } catch (err) {
    logger.error({ err }, 'Error seeding challenges catalog.');
  }
}
