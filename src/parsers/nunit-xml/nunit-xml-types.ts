export interface NunitReport {
  testrun: TestRun
}

export interface TestRun {
  $: {
    id: string
    testcasecount: string
    result: string
    label: string
    total: string
    passed: string
    failed: string
    inconclusive: string
    skipped: string
    asserts: string
    duration: string
  }

  testsuite: TestSuite[]
}

export interface TestSuite {
  $: {
    type: string
    id: string
    name: string
    fullname: string
    runstate: string
    testcasecount: string
    result: string
    duration: string
    total: string
    passed: string
    failed: string
    inconclusive: string
    skipped: string
    asserts: string
  }

  testsuite: TestSuite[]
  testcase: TestCase[]
}

export interface TestCase {
  $: {
    id: string
    name: string
    fullname: string
    methodname: string
    classname: string
    runstate: string
    result: string
    duration: string
    asserts: string
  }
  failure: ErrorInfo[]
}

export interface ErrorInfo {
  message: string[]
  stacktrace: string[]
}

export type Outcome = 'Passed' | 'NotExecuted' | 'Failed'
