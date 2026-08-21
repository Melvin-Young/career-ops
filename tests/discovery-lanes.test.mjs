import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoveryClassifier } from '../lib/discovery-lanes.mjs';

const classifier = buildDiscoveryClassifier({
  enabled: true,
  broad_title_keywords: ['Platform Engineer', 'Solutions Engineer', 'Solutions Architect', 'Automation'],
  ai_context_keywords: ['AI', 'LLM', 'Agentic', 'GenAI'],
  ai_focused_companies: ['LangChain', 'Glean'],
  local_location_keywords: ['Home Region', 'Home City'],
  eligible_country_keywords: ['United States', 'USA', 'US', 'North America'],
  foreign_location_keywords: ['Canada', 'Italy', 'UAE', 'London', 'Europe'],
  onsite_keywords: ['On-site', 'Onsite', 'Hybrid'],
});

test('specific eligible-country remote and configured-local roles are likely', () => {
  assert.equal(classifier.classify({ company: 'ElevenLabs', title: 'Forward Deployed Engineer - North America', location: 'Remote · San Francisco · United States' }).lane, 'likely');
  assert.equal(classifier.classify({ company: 'Acme', title: 'Applied AI Engineer', location: 'Home City' }).lane, 'likely');
});

test('ambiguous remote and missing-location roles remain visible for verification', () => {
  assert.equal(classifier.classify({ company: 'Acme', title: 'Applied AI Engineer', location: 'Remote' }).lane, 'verify');
  assert.equal(classifier.classify({ company: 'Acme', title: 'Agentic Engineer', location: '' }).lane, 'verify');
});

test('multi-region remote roles containing the US are verify, not excluded', () => {
  const result = classifier.classify({ company: 'Cohere', title: 'Applied AI Engineer', location: 'Remote · Canada · United States' });
  assert.equal(result.lane, 'verify');
  assert.ok(result.reasons.includes('multi-region-remote'));
});

test('explicit foreign-only and out-of-area onsite roles are excluded', () => {
  assert.equal(classifier.classify({ company: 'Acme', title: 'Applied AI Engineer', location: 'Remote · Italy' }).lane, 'excluded');
  assert.equal(classifier.classify({ company: 'Acme', title: 'Applied AI Engineer', location: 'Hybrid · New York, NY' }).lane, 'excluded');
});

test('broad titles need AI context or an AI-focused company', () => {
  assert.equal(classifier.classify({ company: 'Factory Co', title: 'Automation Technician', location: 'Home City' }).lane, 'excluded');
  assert.equal(classifier.classify({ company: 'Factory Co', title: 'AI Automation Engineer', location: 'Remote · US' }).lane, 'likely');
  assert.equal(classifier.classify({ company: 'LangChain', title: 'Solutions Engineer', location: 'Remote · Chicago, IL' }).lane, 'verify');
});

test('US state abbreviations and names establish US location without substring collisions', () => {
  assert.equal(classifier.classify({ company: 'Acme', title: 'Applied AI Engineer', location: 'Remote · Mountain View, CA' }).lane, 'likely');
  assert.equal(classifier.classify({ company: 'Acme', title: 'Applied AI Engineer', location: 'Remote · Canada' }).lane, 'excluded');
});

test('disabled policy is explicit at the interface', () => {
  const disabled = buildDiscoveryClassifier({ enabled: false });
  assert.equal(disabled.enabled, false);
});
