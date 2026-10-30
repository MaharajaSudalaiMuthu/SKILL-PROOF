import { DetectorFinding } from '@skillproof/shared';
import { ParsedJavaFile } from '../ast/javaAstHelper.js';
import { SymbolIndex } from '../ast/symbolIndex.js';

export function detectJwt(
  file: ParsedJavaFile,
  _index: SymbolIndex
): DetectorFinding[] {
  const findings: DetectorFinding[] = [];
  const content = file.rawContent;

  for (const type of file.types) {
    const classText = type.rawText;

    // 1. Detect Issuance
    const hasJjwtIssuance = classText.includes('Jwts.builder()') && (classText.includes('.signWith(') || classText.includes('.compact()'));
    const hasAuth0Issuance = classText.includes('JWT.create()') && classText.includes('.sign(');
    const hasNimbusIssuance = classText.includes('SignedJWT(') && classText.includes('.sign(');
    const hasSpringJwtIssuance = classText.includes('JwtEncoder') && classText.includes('.encode(');
    const isIssuance = hasJjwtIssuance || hasAuth0Issuance || hasNimbusIssuance || hasSpringJwtIssuance;

    // 2. Detect Validation
    const hasJjwtValidation =
      (classText.includes('Jwts.parser()') || classText.includes('Jwts.parserBuilder()')) &&
      (classText.includes('.parseClaimsJws(') || classText.includes('.parseSignedClaims(') || classText.includes('.parse('));
    const hasAuth0Validation = classText.includes('JWT.require(') && classText.includes('.verify(');
    const hasNimbusValidation = classText.includes('.verify(') && (content.includes('com.nimbusds') || classText.includes('JWSVerifier'));
    const hasSpringJwtValidation = classText.includes('JwtDecoder') && classText.includes('.decode(');
    const isValidation = hasJjwtValidation || hasAuth0Validation || hasNimbusValidation || hasSpringJwtValidation;

    if (!isIssuance && !isValidation) {
      continue;
    }

    // Key attributes
    const hasFilterIntegration =
      type.extendsTypes.some((ext) => ext.includes('OncePerRequestFilter') || ext.includes('GenericFilterBean')) ||
      classText.includes('OncePerRequestFilter');
    const hasExpiryCheck =
      classText.includes('.setExpiration(') ||
      classText.includes('.withExpiresAt(') ||
      classText.includes('getExpiration()') ||
      classText.includes('isTokenExpired');
    const hasLiteralSecret = /(?:secret|key)\s*=\s*"[^"]{4,}"/i.test(classText);

    let libraryName = 'Unknown';
    if (hasJjwtIssuance || hasJjwtValidation) libraryName = 'io.jsonwebtoken (JJWT)';
    else if (hasAuth0Issuance || hasAuth0Validation) libraryName = 'com.auth0 (java-jwt)';
    else if (hasNimbusIssuance || hasNimbusValidation) libraryName = 'com.nimbusds (Nimbus)';
    else if (hasSpringJwtIssuance || hasSpringJwtValidation) libraryName = 'Spring Security JwtEncoder/Decoder';

    findings.push({
      skillSlug: 'jwt-issuance-validation',
      detectorName: 'jwt-issuance-validation',
      detectorVersion: '1.0.0',
      filePath: file.filePath,
      startLine: type.startLine,
      endLine: type.endLine,
      matchedPattern: `JWT ${isIssuance && isValidation ? 'Issuance & Validation' : isIssuance ? 'Issuance' : 'Validation'} using ${libraryName}`,
      keyAttributes: {
        className: type.name,
        library: libraryName,
        isIssuance,
        isValidation,
        hasFilterIntegration,
        hasExpiryCheck,
        hasLiteralSecret,
      },
      whatThisShows:
        'Implements JWT token creation, signing, or cryptographic signature verification using recognized security libraries.',
      whatThisDoesNotProve: 'Does not prove secure key management, adequate secret entropy, or algorithm-none protection.',
    });
  }

  return findings;
}
