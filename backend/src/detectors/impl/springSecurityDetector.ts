import { DetectorFinding } from '@skillproof/shared';
import { ParsedJavaFile } from '../ast/javaAstHelper.js';
import { SymbolIndex } from '../ast/symbolIndex.js';

export function detectSpringSecurity(
  file: ParsedJavaFile,
  _index: SymbolIndex
): DetectorFinding[] {
  const findings: DetectorFinding[] = [];

  for (const type of file.types) {
    if (type.kind !== 'class') continue;

    const hasEnableWebSecurity = type.annotations.some((a) => a.name === 'EnableWebSecurity');
    const isConfig = type.annotations.some((a) => a.name === 'Configuration');
    const extendsAdapter = type.extendsTypes.some((ext) => ext.includes('WebSecurityConfigurerAdapter'));

    const securityFilterChainBean = type.methods.find(
      (m) =>
        m.annotations.some((a) => a.name === 'Bean') &&
        (m.returnType.includes('SecurityFilterChain') || m.rawText.includes('SecurityFilterChain'))
    );

    if (!hasEnableWebSecurity && !extendsAdapter && !(isConfig && securityFilterChainBean)) {
      continue;
    }

    // Inspect request authorization rules in HttpSecurity
    const classText = type.rawText;
    const authRules = [
      'authorizeHttpRequests',
      'requestMatchers',
      'authenticated',
      'hasRole',
      'hasAuthority',
      'permitAll',
      'denyAll',
      'antMatchers',
      'authorizeRequests',
    ];

    const matchedRules = authRules.filter((rule) => classText.includes(rule));
    if (matchedRules.length === 0) {
      continue;
    }

    // Record key attributes
    const hasPasswordEncoder = classText.includes('PasswordEncoder') || classText.includes('BCryptPasswordEncoder');
    const hasCors = classText.includes('.cors(');
    const hasCsrf = classText.includes('.csrf(');
    const hasSessionManagement = classText.includes('sessionManagement') || classText.includes('STATELESS');
    const hasCustomFilter = classText.includes('addFilterBefore') || classText.includes('addFilterAfter');

    findings.push({
      skillSlug: 'spring-security-configuration',
      detectorName: 'spring-security-configuration',
      detectorVersion: '1.0.0',
      filePath: file.filePath,
      startLine: type.startLine,
      endLine: type.endLine,
      matchedPattern: `Spring Security configuration in ${type.name} with rules: ${matchedRules.slice(0, 3).join(', ')}`,
      keyAttributes: {
        className: type.name,
        rules: matchedRules,
        hasPasswordEncoder,
        hasCors,
        hasCsrf,
        hasSessionManagement,
        hasCustomFilter,
      },
      whatThisShows:
        'Configures Spring Security request authorization rules, SecurityFilterChain bean, and authentication settings.',
      whatThisDoesNotProve: 'Does not prove the configuration is secure, complete, or free of authorization bypass vulnerabilities.',
    });
  }

  return findings;
}
