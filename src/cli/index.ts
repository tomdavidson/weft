#!/usr/bin/env bun
import { resolve } from 'node:path'
import { build } from '../application/build.js'
import { createNodeFileSystem } from '../infrastructure/node-fs.js'
import { parseArgs } from './parse-args.js'

const USER_ARGS_START = 2

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
  const outputPath = resolve(args.cwd, args.outputPath)

  const result = await build({
    entryPath,
    outputPath,
    contextSources: args.contextSources,
    cwd: args.cwd,
    ext: args.ext,
  }, fs)

  if (result.isErr()) {
    console.error(result.error.message)
    process.exit(1)
  }

  process.stdout.write('Built: ' + outputPath + '\n')
}

void main()
