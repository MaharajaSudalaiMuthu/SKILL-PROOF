package com.skillproof.sample;

import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

// 1. Sealed Interface with Permits (Java 17)
sealed interface PaymentResult permits SuccessPayment, FailedPayment {}

final class SuccessPayment implements PaymentResult {
    private final String transactionId;
    public SuccessPayment(String id) { this.transactionId = id; }
    public String getTransactionId() { return transactionId; }
}

final class FailedPayment implements PaymentResult {
    private final String reason;
    public FailedPayment(String reason) { this.reason = reason; }
    public String getReason() { return reason; }
}

// 2. Java Record with Bean Validation constraints (Java 16+)
record PaymentRequest(
    @NotBlank String accountId,
    @NotNull Double amount,
    String currency
) {}

// 3. Spring Rest Controller with Multiple Verbs & Modern Syntax
@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    // 4. Text Block (Java 15+)
    private static final String DEFAULT_RECEIPT_TEMPLATE = """
        ========================================
        RECEIPT CONFIRMATION
        SkillProof Automated Capability Analysis
        ========================================
        """;

    @PostMapping("/process")
    @Transactional
    public PaymentResult processPayment(@Valid @RequestBody PaymentRequest request) {
        // 5. Switch Expression with Pattern Matching / Yield (Java 17+)
        int priority = switch (request.currency() != null ? request.currency() : "USD") {
            case "USD", "EUR" -> 1;
            case "GBP" -> 2;
            default -> {
                System.out.println("Standard processing queue");
                yield 3;
            }
        };

        if (request.amount() > 0) {
            return new SuccessPayment("TXN-" + priority + "-OK");
        } else {
            return new FailedPayment("Invalid amount");
        }
    }

    @GetMapping("/{id}")
    public PaymentResult getPayment(@PathVariable("id") String id) {
        return new SuccessPayment(id);
    }
}
