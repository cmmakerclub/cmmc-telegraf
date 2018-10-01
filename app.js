#!/usr/bin/env node
'use strict'

const pkg = require('./package.json')
const program = require('commander')
const fs = require('fs')
const Mustache = require('mustache')
const inquirer = require('inquirer')
var child_process = require('child_process')
const configStore = require('./Configstore')

Mustache.escape = text => { return text }

program
  .name(pkg.name)
  .usage('[options]')
  .version(pkg.version)
  .option('-i, --init', 'initialize project')
  .option('-r, --run [appname]', 'run project')
  .option('-d, --debug [appname]', 'debug project')
  .option('-w, --warp', 'warp to data dir.')
  .option('-l, --list', 'list application')
  .option('-r, --regenerate', 'regenerate all applications config')
  .option('-c, --create [appname]', 'create application')
// .action((type, args) => {
//   // console.log(`type = `, type)
//   // console.log(`args= `, args)
// })

program.parse(process.argv)

const regenerate = function () {
  const dir = `${CONFIG_PATH}/configs`
  const TEMPLATE_TELEGRAF = fs.readFileSync(`${CONFIG_PATH}/templates/template_telegraf.conf`, 'utf8')
  const TEMPLATE_DOCKER_DEBUG = fs.readFileSync(`${CONFIG_PATH}/templates/template_docker-debug.conf`, 'utf8')
  const TEMPLATE_DOCKER_PROD = fs.readFileSync(`${CONFIG_PATH}/templates/template_docker-prod.conf`, 'utf8')

  const configFiles = fs.readdirSync(`${CONFIG_PATH}/configs`)
    .filter(file => fs.statSync(dir + '/' + file).isFile())
    .map(file => file.split('.')[0])

  configFiles.forEach((name, idx) => {
    let config = require(`${CONFIG_PATH}/configs/${name}.json`)
    const beWrittenFiles = [
      {
        file: `${CONFIG_PATH}/telegraf/${name}.conf`,
        content: Mustache.render(TEMPLATE_TELEGRAF, Object.assign({}, config, {debug: 'false', quiet: 'true'}))
      },
      {
        file: `${CONFIG_PATH}/telegraf/debug_${name}.conf`,
        content: Mustache.render(TEMPLATE_TELEGRAF, Object.assign({}, config, {debug: 'true', quiet: 'false'}))
      },
      {
        file: `${CONFIG_PATH}/scripts/${name}.sh`,
        content: Mustache.render(TEMPLATE_DOCKER_PROD, {
          config_name: `${name}`,
          config_path: `${CONFIG_PATH}/telegraf`
        })
      },
      {
        file: `${CONFIG_PATH}/scripts/debug_${name}.sh`,
        content: Mustache.render(TEMPLATE_DOCKER_DEBUG, {
          config_name: `${name}`,
          config_path: `${CONFIG_PATH}/telegraf`
        })
      }
    ]
    beWrittenFiles.forEach(item => {
      fs.writeFileSync(item.file, item.content)
      console.log(`> writing ${item.file}... done.`)
    })
  })

}
const listApps = () => {
  const dir = `${CONFIG_PATH}/configs`
  const configFiles = fs.readdirSync(dir)
    .filter(file => fs.statSync(dir + '/' + file).isFile())
    .map(file => file.split('.')[0])
  configFiles.forEach((config, idx) => {
    console.log(`${idx + 1}) ${config}`)
  })
}

const CONFIG_DIR = 'telegraf-context'
let CONFIG_PATH = configStore.get('CONFIG_PATH')

const initialize = () => {
  configStore.set('CONFIG_PATH', `${process.cwd()}/${CONFIG_DIR}`)
  CONFIG_PATH = configStore.get('CONFIG_PATH')
  const dirs = [
    `${CONFIG_PATH}`,
    `${CONFIG_PATH}/templates`,
    `${CONFIG_PATH}/configs`,
    `${CONFIG_PATH}/telegraf`,
    `${CONFIG_PATH}/scripts`]
  dirs.forEach(dir => {
    try {
      console.log(`> creating directory ${dir}`)
      fs.mkdirSync(dir)
    }
    catch (e) {
      // console.log(e)
    }
  })

  let templateTelegraf = fs.readFileSync(`${__dirname}/_template_telegraf.conf`, 'utf8')
  let templatedDockerDebug = fs.readFileSync(`${__dirname}/_template_docker-debug.conf`, 'utf8')
  let templatedDockerProd = fs.readFileSync(`${__dirname}/_template_docker-prod.conf`, 'utf8')
  let templateConfig = fs.readFileSync(`${__dirname}/_template_config.json`, 'utf8')

  console.log(`> loading default configurations... done.`)

  fs.writeFileSync(`${CONFIG_PATH}/templates/template_telegraf.conf`, templateTelegraf)
  fs.writeFileSync(`${CONFIG_PATH}/templates/template_docker-debug.conf`, templatedDockerDebug)
  fs.writeFileSync(`${CONFIG_PATH}/templates/template_docker-prod.conf`, templatedDockerProd)
  fs.writeFileSync(`${CONFIG_PATH}/templates/template_config.json`, templateConfig)
  console.log(`The new path is ${configStore.get('CONFIG_PATH')}`)
}

if (!program.init && !CONFIG_PATH) {
  console.log('no CONFIG_PATH defined.')
  process.exit(1)
}

if (program.init) {
  CONFIG_PATH = configStore.get('CONFIG_PATH')
  if (CONFIG_PATH) {
    console.log(`current path = ${CONFIG_PATH}`)
    console.log(`new path = ${process.cwd()}/${CONFIG_DIR}`)
    var questions = [{
      type: 'confirm',
      name: 'confirm',
      default: false,
      message: `Are you sure?`
    }]
    inquirer.prompt(questions).then(ans => {
      if (ans.confirm) {
        initialize()
      }
    })
  }
  else {
    initialize()
  }
}
else if (program.list) {
  listApps()
}
else if (program.regenerate) {
  regenerate()
}
else if (program.create) {
  program.args.forEach((appName, idx) => {
    let createAppConfigTemplate = fs.readFileSync(`${CONFIG_PATH}/templates/template_config.json`, 'utf8')
    const filePath = `${CONFIG_PATH}/configs/${appName}.json`
    const createAppConfig = Mustache.render(createAppConfigTemplate, {appName})
    fs.writeFileSync(filePath, createAppConfig)
    console.log(`> creating file ${filePath}...  done.`)
  })
}
else if (program.warp) {
  console.log(`cd ${CONFIG_PATH}`)
}
else if (program.run) {
  if (!program.args[0]) {
    listApps()
    console.log('invalid app parameter.')
    console.log('call --list or --help for more information')
  }
  else {
    regenerate()
    const r = child_process.execFileSync('bash', [`${CONFIG_PATH}/scripts/${program.args[0]}.sh`], {
      stdio: 'inherit'
    })
  }
}
else if (program.debug) {
  if (!program.args[0]) {
    listApps()
    console.log('invalid app parameter.')
    console.log('call --list or --help for more information')
  }
  else {
    regenerate()
    const r = child_process.execFileSync('bash', [`${CONFIG_PATH}/scripts/debug_${program.args[0]}.sh`], {
      stdio: 'inherit'
    })
  }
}
else {
}

