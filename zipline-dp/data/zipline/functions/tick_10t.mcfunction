#built using mc-build (https://github.com/mc-build/mc-build)

execute as @e[type=marker,tag=front_zipline] at @s run particle dust 0.098 0.62 0.098 1 ~ ~ ~ 0 0 0 0 1 force
execute as @e[type=marker,tag=end_zipline] at @s run particle dust 0.62 0.098 0.098 1 ~ ~ ~ 0 0 0 0 1 force
execute as @e[type=marker,tag=front_zipline,tag=reset,limit=1] at @s run function zipline:__generated__/block/15
execute as @e[type=item,nbt={Item:{id:"minecraft:iron_ingot",Count:4b}}] at @s if entity @e[type=item,nbt={Item:{id:"minecraft:lead",Count:1b}},distance=..0.5] run function zipline:__generated__/block/16
execute as @e[type=item,nbt={Item:{id:"minecraft:iron_ingot",Count:2b}}] at @s if entity @e[type=item,nbt={Item:{id:"minecraft:redstone",Count:2b}},distance=..0.5] run function zipline:__generated__/block/17
execute as @e[type=item,nbt={Item:{id:"minecraft:tripwire_hook",Count:1b}}] at @s if entity @e[type=item,nbt={Item:{id:"minecraft:iron_ingot",Count:3b}},distance=..0.5] run function zipline:__generated__/block/18
schedule function zipline:tick_10t 10t