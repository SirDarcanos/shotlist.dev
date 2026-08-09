/**
 * Package `examples/shotlist-example/` as the download the tutorials begin with.
 *
 * The zip is generated rather than committed, so the folder in this repository is the one
 * source of truth for it — a reviewer reads the files, not a binary, and the two cannot
 * drift apart.
 *
 * It is written here rather than shelled out to `zip`, which is what this did until a
 * deploy failed: the build container has no `zip` on PATH, and a site that cannot build
 * away from a developer's laptop is not built. Node has the two primitives the format
 * needs — `deflateRawSync` and `crc32` — so the archive costs a dependency neither.
 */
import { deflateRawSync, crc32 } from 'node:zlib'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SOURCE = 'examples/shotlist-example'
const INSIDE = 'shotlist-example'
const OUT = 'public/shotlist-example.zip'
/** Things a reader's own run creates, which have no business in a starter. */
const SKIP = new Set(['node_modules', 'images', '.shotlist', '.DS_Store'])

/*
 * A fixed timestamp, so the same folder always produces the same bytes. The zip is a
 * build artifact; one that changes every run is one that looks changed every run.
 */
const DOS_TIME = 0 // 00:00:00
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1 // 2020-01-01

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else files.push(path)
  }
}
walk(SOURCE)

const parts = []
const central = []
let offset = 0

for (const path of files) {
  const name = `${INSIDE}/${relative(SOURCE, path)}`.replaceAll('\\', '/')
  const body = readFileSync(path)
  const deflated = deflateRawSync(body)
  // Deflate can be larger than the input on tiny or already-dense files; store those.
  const compress = deflated.length < body.length
  const payload = compress ? deflated : body
  const nameBytes = Buffer.from(name, 'utf8')
  const sum = crc32(body)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4) // version needed
  local.writeUInt16LE(0, 6) // flags
  local.writeUInt16LE(compress ? 8 : 0, 8) // method
  local.writeUInt16LE(DOS_TIME, 10)
  local.writeUInt16LE(DOS_DATE, 12)
  local.writeUInt32LE(sum, 14)
  local.writeUInt32LE(payload.length, 18)
  local.writeUInt32LE(body.length, 22)
  local.writeUInt16LE(nameBytes.length, 26)
  local.writeUInt16LE(0, 28) // extra length
  parts.push(local, nameBytes, payload)

  const entry = Buffer.alloc(46)
  entry.writeUInt32LE(0x02014b50, 0)
  entry.writeUInt16LE(20, 4) // version made by
  entry.writeUInt16LE(20, 6) // version needed
  entry.writeUInt16LE(0, 8)
  entry.writeUInt16LE(compress ? 8 : 0, 10)
  entry.writeUInt16LE(DOS_TIME, 12)
  entry.writeUInt16LE(DOS_DATE, 14)
  entry.writeUInt32LE(sum, 16)
  entry.writeUInt32LE(payload.length, 20)
  entry.writeUInt32LE(body.length, 24)
  entry.writeUInt16LE(nameBytes.length, 28)
  entry.writeUInt16LE(0, 30) // extra
  entry.writeUInt16LE(0, 32) // comment
  entry.writeUInt16LE(0, 34) // disk
  entry.writeUInt16LE(0, 36) // internal attrs
  // `rw-r--r--`, in the high half where unix modes live. Without it the files come out
  // with whatever mode the unzipping tool invents.
  entry.writeUInt32LE(0o644 << 16, 38)
  entry.writeUInt32LE(offset, 42)
  central.push(entry, nameBytes)

  offset += local.length + nameBytes.length + payload.length
}

const directory = Buffer.concat(central)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(0, 4) // this disk
end.writeUInt16LE(0, 6) // disk with the directory
end.writeUInt16LE(files.length, 8)
end.writeUInt16LE(files.length, 10)
end.writeUInt32LE(directory.length, 12)
end.writeUInt32LE(offset, 16)
end.writeUInt16LE(0, 20) // comment length

mkdirSync('public', { recursive: true })
writeFileSync(OUT, Buffer.concat([...parts, directory, end]))

console.log(`  example project packaged → ${OUT} (${files.length} files)`)
