import {parseStringPromise} from 'xml2js'

import {ErrorInfo, Outcome, NunitReport, TestCase,  TestSuite} from './nunit-xml-types'
import {ParseOptions, TestParser} from '../../test-parser'

import {getBasePath, normalizeFilePath} from '../../utils/path-utils'
import {parseNetDuration} from '../../utils/parse-utils'

import {
  TestExecutionResult,
  TestRunResult,
  TestSuiteResult,
  TestGroupResult,
  TestCaseResult,
  TestCaseError
} from '../../test-results'

class TestClass {
  constructor(readonly name: string) {}
  readonly tests: Test[] = []
}

class Test {
  constructor(
    readonly name: string,
    readonly outcome: Outcome | undefined,
    readonly duration: number,
    readonly error?: ErrorInfo 
  ) {}

  get result(): TestExecutionResult | undefined {
    switch (this.outcome) {
      case 'Passed':
        return 'success'
      case 'NotExecuted':
        return 'skipped'
      case 'Failed':
        return 'failed'
    }
  }
}

export class NunitParser implements TestParser {
  assumedWorkDir: string | undefined

  constructor(readonly options: ParseOptions) {}

  async parse(path: string, content: string): Promise<TestRunResult> {
    const report = await this.getNunitReport(path, content)

    const tc = this.getTestClasses(report)
    
    const tr = this.getTestRunResult(path, report, tc)
    tr.sort(true)
    return tr
  }

  private async getNunitReport(path: string, content: string): Promise<NunitReport> {
    try {
      return (await parseStringPromise(content)) as NunitReport
    } catch (e) {
      throw new Error(`Invalid XML at ${path}\n\n${e}`)
    }
  }

  private getTestClasses(nunit: NunitReport): TestClass[] {
    if (nunit.testrun === undefined || nunit.testrun.testsuite === undefined) {
      return []
    }

    const unitTests: TestCase[] =nunit.testrun.testsuite.flatMap(ts  => this.getAllTestCase(ts))
 
    const testClasses: {[name: string]: TestClass} = {}

    for (const testCase of unitTests) {
      const className = testCase.$.classname

      let tc = testClasses[className]
      if (tc === undefined) {
        tc = new TestClass(className)
        testClasses[tc.name] = tc
      }

      const error = this.getErrorInfo(testCase)
      const durationAttr = testCase.$.duration
      const duration = durationAttr ? parseNetDuration(durationAttr) : 0

      const test = new Test(testCase.$.name, this.getOutcome(testCase), duration, error)
      tc.tests.push(test)
    }

    const result = Object.values(testClasses)
    return result
  }

  private getTestRunResult(path: string, report: NunitReport, testClasses: TestClass[]): TestRunResult {
    
    const totalTime = report.testrun.$.duration ? parseNetDuration(report.testrun.$.duration) : 0

    const suites = testClasses.map(testClass => {
      const tests = testClass.tests.map(test => {
        const error = this.getError(test)
        return new TestCaseResult(test.name, test.result, test.duration, error)
      })
      const group = new TestGroupResult(null, tests)
      return new TestSuiteResult(testClass.name, [group])
    })

    return new TestRunResult(path, suites, totalTime)
  }

  private getAllTestCase(testsuite: TestSuite): TestCase[]
  {
    let testCases: TestCase[] = []
    if (testsuite.testcase !== undefined)
    {
      testCases = testCases.concat(testsuite.testcase)
    }

    if (testsuite.testsuite !== undefined)
      testsuite.testsuite.forEach(ts => {
        testCases = testCases.concat(this.getAllTestCase(ts))
      });
      
    return testCases;
  }

  private getOutcome(testCase:TestCase): Outcome | undefined {
    switch (testCase.$.result) {
      case 'Passed':
        return 'Passed'
      case 'NotExecuted':
        return 'NotExecuted'
      case 'Failed':
        return 'Failed'
    }
    return undefined
  }

  private getErrorInfo(testResult: TestCase): ErrorInfo | undefined {
    if (testResult.$.result !== 'Failed') {
      return undefined
    }

    if (testResult.failure == undefined || testResult.failure.length == 0)
    {
      return undefined
    }

    return testResult.failure[0]
  }

  private getError(test: Test): TestCaseError | undefined {
    if (!this.options.parseErrors || !test.error) {
      return undefined
    }

    const error = test.error
    if (
      !Array.isArray(error.Message) ||
      error.Message.length === 0 ||
      !Array.isArray(error.StackTrace) ||
      error.StackTrace.length === 0
    ) {
      return undefined
    }

    const message = test.error.Message[0]
    const stackTrace = test.error.StackTrace[0]
    let path
    let line

    const src = this.exceptionThrowSource(stackTrace)
    if (src) {
      path = src.path
      line = src.line
    }

    return {
      path,
      line,
      message,
      details: `${message}\n${stackTrace}`
    }
  }

  private exceptionThrowSource(stackTrace: string): {path: string; line: number} | undefined {
    const lines = stackTrace.split(/\r*\n/)
    const re = / in (.+):line (\d+)$/
    const {trackedFiles} = this.options

    for (const str of lines) {
      const match = str.match(re)
      if (match !== null) {
        const [_, fileStr, lineStr] = match
        const filePath = normalizeFilePath(fileStr)
        const workDir = this.getWorkDir(filePath)
        if (workDir) {
          const file = filePath.substr(workDir.length)
          if (trackedFiles.includes(file)) {
            const line = parseInt(lineStr)
            return {path: file, line}
          }
        }
      }
    }
  }

  private getWorkDir(path: string): string | undefined {
    return (
      this.options.workDir ??
      this.assumedWorkDir ??
      (this.assumedWorkDir = getBasePath(path, this.options.trackedFiles))
    )
  }
}
