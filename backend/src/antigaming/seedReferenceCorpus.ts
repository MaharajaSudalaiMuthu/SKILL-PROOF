import { ReferenceFingerprint } from '../models/ReferenceFingerprint.js';
import { computeWinnowingFingerprints } from './winnowing.js';
import { logger } from '../middleware/pinoLogger.js';

const REFERENCE_STARTERS: Record<string, string[]> = {
  'spring-petclinic': [
    `package org.springframework.samples.petclinic.owner;
    import java.util.List;
    import org.springframework.data.repository.Repository;
    import org.springframework.transaction.annotation.Transactional;

    public interface OwnerRepository extends Repository<Owner, Integer> {
      @Transactional(readOnly = true)
      List<Owner> findByLastName(String lastName);
      @Transactional(readOnly = true)
      Owner findById(Integer id);
      void save(Owner owner);
    }`,
    `package org.springframework.samples.petclinic.owner;
    import jakarta.persistence.Column;
    import jakarta.persistence.Entity;
    import jakarta.persistence.Table;
    import jakarta.validation.constraints.NotEmpty;

    @Entity
    @Table(name = "owners")
    public class Owner extends Person {
      @Column(name = "address")
      @NotEmpty
      private String address;
      @Column(name = "city")
      @NotEmpty
      private String city;
      @Column(name = "telephone")
      @NotEmpty
      private String telephone;
    }`,
  ],
  'gs-rest-service': [
    `package com.example.restservice;
    import java.util.concurrent.atomic.AtomicLong;
    import org.springframework.web.bind.annotation.GetMapping;
    import org.springframework.web.bind.annotation.RequestParam;
    import org.springframework.web.bind.annotation.RestController;

    @RestController
    public class GreetingController {
      private static final String template = "Hello, %s!";
      private final AtomicLong counter = new AtomicLong();

      @GetMapping("/greeting")
      public Greeting greeting(@RequestParam(value = "name", defaultValue = "World") String name) {
        return new Greeting(counter.incrementAndGet(), String.format(template, name));
      }
    }`,
  ],
  'gs-accessing-data-jpa': [
    `package com.example.accessingdatajpa;
    import java.util.List;
    import org.springframework.data.repository.CrudRepository;

    public interface CustomerRepository extends CrudRepository<Customer, Long> {
      List<Customer> findByLastName(String lastName);
      Customer findById(long id);
    }`,
    `package com.example.accessingdatajpa;
    import jakarta.persistence.Entity;
    import jakarta.persistence.GeneratedValue;
    import jakarta.persistence.GenerationType;
    import jakarta.persistence.Id;

    @Entity
    public class Customer {
      @Id
      @GeneratedValue(strategy=GenerationType.AUTO)
      private Long id;
      private String firstName;
      private String lastName;
    }`,
  ],
};

export async function seedReferenceCorpus(): Promise<void> {
  for (const [projectName, sources] of Object.entries(REFERENCE_STARTERS)) {
    const existingCount = await ReferenceFingerprint.countDocuments({ projectName });
    if (existingCount > 0) {
      continue;
    }

    const hashes = new Set<string>();
    for (const src of sources) {
      const fps = computeWinnowingFingerprints(src);
      for (const h of fps) {
        hashes.add(h);
      }
    }

    const docs = Array.from(hashes).map((h) => ({
      projectName,
      commitSha: 'HEAD',
      fingerprintHash: h,
    }));

    if (docs.length > 0) {
      await ReferenceFingerprint.insertMany(docs);
      logger.info({ projectName, fingerprintCount: docs.length }, 'Seeded reference project fingerprints.');
    }
  }
}
