const mineflayer = require('mineflayer')
const autoEat = require('@nxg-org/mineflayer-auto-eat')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const MinecraftData = require('minecraft-data')
const toolPlugin = require('mineflayer-tool').plugin
const readline = require('readline')
const { version } = require('os')

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve))
async function startBot() {
    console.log('\n------- Настройка бота -------')
    
    const host = await askQuestion('Введите хост (По умолчанию localhost):') || 'localhost';

    const portinput = await askQuestion('Ведите порт:') 
    
    const version = await askQuestion('Введите версию Minecraft:')

    createMyBot('Bot_1', 1,  host, portinput, version)
    createMyBot('Bot_2', 2, host, portinput, version)
    createDiggerBot('BotDigger', 3, host, portinput, version)

    rl.close()
}

//---------------Бот афк------------------
function createMyBot(botName, botid, customhost, customport, customversion) {
    
    const Trigger = `tp${botid}`;
    const leaveTrigger = `leave${botid}`;
    const minecommand = `mine${botid}`;
    
    const bot = mineflayer.createBot({
        host: customhost,
        port: customport, 
        username: botName,
        version: customversion
    });

    let forcedQuit = false;

    bot.once('spawn', () => {
        bot.chat('Афк бот успешно зашел.');
    });

    bot.on('chat', (username, message) => {
        if (username === bot.username) return; 

        if (message.startsWith(Trigger + ' ')) {
            const args = message.split(' ')
            const x = parseFloat(args[1])
            const y = parseFloat(args[2])
            const z = parseFloat(args[3])
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                bot.chat('Неверный формат')
                return;
            }
            
            bot.chat(`/tp ${bot.username} ${x} ${y} ${z}`);
        }
        if (message === leaveTrigger) {
            bot.chat(`${botName} Выход`);
            console.log(`${botName} Выход по команде`);
            forcedQuit = true;
            bot.quit();
        }
    });

    bot.loadPlugin(autoEat.loader)

    bot.once('spawn', () => {
        bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: 18,
            bannedFood: []
        }
    });
    
    bot.on('autoeat_started', () => {
        console.log('Кушаю')
    });

    bot.on('autoeat_stopped', () => {
        console.log('Покушал')
    });

    bot.on('health', () => {
        if (bot.food === 20) bot.autoEat.disableAuto()
        else bot.autoEat.enableAuto()
    });
    
    bot.on('health', () => {
        console.log(`[Статус] ${botName} Здоровье: ${bot.health}, \n[Статус] ${botName} Голод: ${bot.food}`);
    });

    bot.on('death', () => {
        console.log(`[Внимание!] Бот погиб!`);
    });
}
//--------------------------------------------------------

//--------------- БОТ ШАХТЕР -------------------
function createDiggerBot(BotName, botid, customhost, customport, customversion) {

    const trigger = `tp${botid}`;
    const leaveTrigger = `l${botid}`;
    const minecommand = `mine${botid}`;
    
    const bot = mineflayer.createBot({
        host: customhost,
        port: customport,
        username: BotName,
        version: customversion
    })

    bot.setMaxListeners(20)
    let forcedQuit = false;
    let isMining = false; 
    let homePosition = null;

    bot.loadPlugin(autoEat.loader)
    bot.loadPlugin(toolPlugin)
    bot.loadPlugin(pathfinder)

    bot.once('spawn', () => {
        const defaultMove = new Movements(bot);
        bot.pathfinder.setMovements(defaultMove);
    })

    bot.on('spawn', () => {
        bot.chat(`Бот шахтер ${BotName} зашел. Команда ${minecommand} [блок] `)
        if (bot.autoEat) {
            bot.autoEat.options = {
                priority: 'foodPoints',
                startAt: 14,
                bannedFood: []
            }
        }
    })

    bot.on('autoeat_started', () => {
        console.log(`[${BotName}] Кушаю`) 
    })
    bot.on('autoeat_stopped', () => {
        console.log(`[${BotName}] Покушал`) 
    })
    
    bot.on('health', () => {
        if (bot.food === 20) bot.autoEat.disableAuto()
        else bot.autoEat.enableAuto()
    })

    bot.on('health', () => {
        console.log(`[Статус] ${BotName} Здоровье: ${bot.health}, Голод: ${bot.food}`)
    })

    bot.on('death', () => {
        console.log(`[Внимание!] ${BotName} погиб!`)
        isMining = false
    })

    bot.on('chat', (username, message) => {
        if (message === '!sethome') {
            const pos = bot.entity.position
            homePosition = {
                x: Math.floor(pos.x),
                y: Math.floor(pos.y),
                z: Math.floor(pos.z)
            }
            bot.chat(`Точка дома сохранена: ${homePosition.x}, ${homePosition.y}, ${homePosition.z}`)
        }

        if (message === '!home') {
            if (homePosition) {
                isMining = false 
                bot.chat('Иду домой...')
                bot.pathfinder.setGoal(new goals.GoalBlock(homePosition.x, homePosition.y, homePosition.z))
            } else {
                bot.chat('Точка дома не установлена! Напишите !sethome')
            }
        }
    })

    bot.on('chat', (username, message) => {
        if (message === '!status'){
            const heldItem = bot.heldItem
            if (heldItem){
                bot.chat(`[Инвентарь] В руке: ${heldItem.name}. Прочность: ${heldItem.maxDurability - heldItem.durabilityUsed}`)
            }
        }
    })

    bot.on('chat', (username, message) => {
        if (message === '!inv'){
            const items = bot.inventory.items()
            if (items.length === 0) {
                bot.chat('Я пуст') 
                return 
            }
            const inventoryList = {}
            items.forEach(item => {
                inventoryList[item.displayName] = (inventoryList[item.displayName] || 0) + item.count
            })
            console.log(`---- Содержимое инвентаря ${BotName} ----`)
            for (const [itemName, count] of Object.entries(inventoryList)){
                console.log(`[Инвентарь] ${itemName}: ${count} шт.`)
            }
        }
    })

    async function checkPickaxe() {
        const pickaxe = bot.inventory.items().find(items => items.name.includes('pickaxe'))
        if (!pickaxe) { bot.chat('У меня нет кирки'); return false; }
        return true
    }

    async function depositItems() {
        const mcdata = require('minecraft-data')(bot.version)
        const checkposition = bot.findBlocks({
            matching: (block) => block.name === 'chest',
            maxDistance: 64,
            count: 10
        })
        if (checkposition.length === 0) { 
            bot.chat('Поблизости нет сундуков.'); return; 
        }

        const movements = new Movements(bot, mcdata)
        movements.canSwim = false
        const blockTypes = bot.registry.blocksByName
        movements.blocksToAvoid.add(blockTypes.lava.id)
        movements.blocksToAvoid.add(blockTypes.water.id)
        movements.blocksToAvoid.add(blockTypes.fire.id)
        bot.pathfinder.setMovements(movements)

        for (const checkpos of checkposition) {
            try {
                await bot.pathfinder.goto(new goals.GoalToConnect(checkpos, bot.world))
                const chestblock = bot.blockAt(checkpos)
                const chest = await bot.openChest(chestblock)
                if (chest.containerItems().length >= chest.window.containerLength) { chest.close(); continue; }

                for (const item of bot.inventory.items()) {
                    if (item.name.includes('pickaxe') || item.name.includes('cooked') || item.name === 'bread') continue
                    try { await chest.deposit(item.type, null, item.count); } catch { break; }
                }
                chest.close(); return
            } catch (err) { console.log(err); }
        }
    }

    const pickaxes = [ 'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'golden_pickaxe',  'diamond_pickaxe', 'netherite_pickaxe']
    
    bot.on('chat', async (username, message) => {
        if (message === '!throw') {
            const chestBlockData = bot.registry.blocksByName['chest']
            if (!chestBlockData) return
            const chestBlock = bot.findBlock({ matching: chestBlockData.id, maxDistance: 4 })
            if (!chestBlock) { bot.chat('Я не вижу рядом сундука'); return; }

            try {
                const chest = await bot.openChest(chestBlock)
                for (const item of bot.inventory.items()){
                    if (!pickaxes.includes(item.name) && !(bot.registry.foodsByName && bot.registry.foodsByName[item.name])){
                        await chest.deposit(item.type, null, item.count)
                        await new Promise(resolve => setTimeout(resolve, 250))
                    }
                }
                chest.close(); bot.chat('Выгрузил')
            } catch (err){ console.log(err); }
        }
    })

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return

        const botnum = trigger.replace('tp', '')
        const mineCommand = `mine${botnum}`

        if (message.startsWith(mineCommand + ' ')) {
            const args = message.split(' ')
            const blockName = args[1]
            
            const targetBlockData = bot.registry.blocksByName[blockName]
            if (!targetBlockData) {
                bot.chat(`Ошибка: Блока "${blockName}" не существует.`)
                return
            }

            if (!(await checkPickaxe())) return
            if (bot.inventory.items().length > 30) await depositItems()

            isMining = true 
            bot.chat(`Ищу жилы: ${blockName}...`)
            const mcData = require('minecraft-data')(bot.version)

            const targetBlocksPositions = bot.findBlocks({
                matching: targetBlockData.id, 
                maxDistance: 64, 
                count: 1000
            })

            if (targetBlocksPositions.length === 0) {
                bot.chat(`Рядом нет блоков "${blockName}"`) 
                isMining = false; return
            }

            targetBlocksPositions.sort((a, b) => bot.entity.position.distanceTo(a) - bot.entity.position.distanceTo(b))
            bot.chat(`Количество блоков которое надо добыть: ${targetBlocksPositions.length}`)

            const movements = new Movements(bot, mcData)
            movements.canSwim = false
            const blockTypes = bot.registry.blocksByName
            movements.blocksToAvoid.add(blockTypes.lava.id)
            movements.blocksToAvoid.add(blockTypes.water.id)
            movements.blocksToAvoid.add(blockTypes.fire.id)
            bot.pathfinder.setMovements(movements)

            for (let i = 0; i < targetBlocksPositions.length; i++) {
                await new Promise(resolve => setTimeout(resolve, 100))
                if (!isMining) break

                const blockPos = targetBlocksPositions[i]
                const targetblock = bot.blockAt(blockPos)
                if (!targetblock || targetblock.name !== blockName) continue

                const goal = new goals.GoalLookAtBlock(blockPos, bot.world)
                console.log(`[${BotName}] Иду к блоку ${i + 1}/${targetBlocksPositions.length}`)
                
                try {
                    await bot.pathfinder.goto(goal)
                } catch (err) {
                    if (!isMining) break 
                    console.log(`[${BotName}] Блок недоступен, пропускаю...`)
                    continue 
                }
                
                if (!isMining) break

                await bot.tool.equipForBlock(targetblock)
                if (!isMining) break

                await bot.lookAt(blockPos.offset(0.5, 0.5, 0.5), true)
                if (!isMining) break

                if (bot.entity.position.distanceTo(blockPos) > 6) continue 
                
                try {
                    await bot.dig(targetblock)
                    if (!isMining) break
                    
                    const pickupGoal = new goals.GoalNear(blockPos.x, blockPos.y, blockPos.z, 1)
                    try {
                        await bot.pathfinder.goto(pickupGoal)
                    } catch (e) {} 
                    
                } catch (digError) {
                    console.error(`[${BotName}] Ошибка копания:`, digError)
                }
            }

            if (isMining) {
                bot.chat('Я закончил сбор всей жилы!')
                isMining = false
            }
        }
    })

    bot.on('chat', (username, message) => {
        if (username === bot.username) return 
        if (message.startsWith(trigger + ' ')) {
            const args = message.split(' ')
            const x = parseFloat(args[1]), y = parseFloat(args[2]), z = parseFloat(args[3])
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) bot.chat(`/tp ${bot.username} ${x} ${y} ${z}`)
        }
        if (message === leaveTrigger) { forcedQuit = true; bot.quit(); }
    })

    bot.on('kicked', () => { console.log(`[${BotName}] Кик с сервера`) })

    bot.on('chat', (username, message) => {
        if (message === '!stop') {
            isMining = false
            bot.pathfinder.stop()
            bot.pathfinder.setGoal(null)
            bot.clearControlStates()
            try { bot.stopDigging(); } catch (e) {}
            bot.chat('Я остановился')
        }
    })

    bot.on('damage', (amount, damageType) => {
        if (isMining) {
            isMining = false 
            bot.pathfinder.stop() 
            bot.pathfinder.setGoal(null)
            bot.clearControlStates()
            try { bot.stopDigging(); } catch (e) {}
            
            console.log(`[${BotName}] Получено ${amount} урона! `)

            if (homePosition) {
                bot.chat(`Иду домой`)
                setTimeout(() => {
                    bot.pathfinder.setGoal(new goals.GoalBlock(homePosition.x, homePosition.y, homePosition.z))
                }, 250)
            } else {
                bot.chat('Выход из-за опасности')
                bot.quit()
            }
        }
    })
}
//---------------------------------------------------------------------------

startBot()
