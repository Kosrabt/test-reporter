import * as fs from 'fs'
import * as path from 'path'

import {NunitParser} from '../src/parsers/nunit-xml/nunit-xml-parser'
import {ParseOptions} from '../src/test-parser'
import {getReport} from '../src/report/get-report'
import {normalizeFilePath} from '../src/utils/path-utils'

describe('nunit tests', () => {
  it('matches report snapshot', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'external', 'nunit', 'test.xml')
    const outputPath = path.join(__dirname, '__outputs__', 'nunit-xml.md')
    const filePath = normalizeFilePath(path.relative(__dirname, fixturePath))
    const fileContent = fs.readFileSync(fixturePath, {encoding: 'utf8'})

    const opts: ParseOptions = {
      parseErrors: true,
      trackedFiles: ['NUnit.Tests']
    }

    const parser = new NunitParser(opts)
    const result = await parser.parse(filePath, fileContent)
    expect(result).toMatchSnapshot()

    const report = getReport([result])
    fs.mkdirSync(path.dirname(outputPath), {recursive: true})
    fs.writeFileSync(outputPath, report)
  })
})
