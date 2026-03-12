#!/usr/bin/env bun
import { resolve } from 'node:path'
import { build } from '../application/build.js'
import { createNodeFileSystem } from '../infrastructure/node-fs.js'
import { parseArgs } from './parse-args.js'

const USER_ARGS_START = 2

const writeOutput = async (
  fs: ReturnType<typeof createNodeFileSystem>,
  outputPath: string | undefined,
  content: string,
): Promise<void> => {
  if (outputPath === undefined) {
    process.stdout.write(content)
    return
  }
  const writeResult = await fs.writeFile(outputPath, content)
  if (writeResult.isErr()) {
    console.error(writeResult.error.message)
    process.exit(1)
  }
  process.stdout.write('Built: ' + outputPath + '\n')
}

const main = async (): Promise<void> => {
  const argv = process.argv.slice(USER_ARGS_START)
  const argsResult = parseArgs(argv)
  if (argsResult.isErr()) {
    console.error(argsResult.error.message)
    process.exit(1)
  }

  const args = argsResult.value
  const fs = createNodeFileSystem()
  const entryPath = resolve(args.cwd, args.entryPath)
  const outputPath = args.outputPath === undefined ? undefined : resolve(args.cwd, args.outputPath)

  const result = await build(
    { entryPath, contextSources: args.contextSources, cwd: args.cwd, ext: args.ext },
    fs,
  )
  if (result.isErr()) {
    console.error(result.error.message)
    process.exit(1)
  }

  await writeOutput(fs, outputPath, result.value)
}

void main()
