#built using mc-build (https://github.com/mc-build/mc-build)

scoreboard objectives add lub.rightclick minecraft.used:carrot_on_a_stick
scoreboard objectives add lub.sneak minecraft.custom:sneak_time
scoreboard objectives add zip.count dummy
scoreboard objectives add zip.move dummy
scoreboard objectives add zip.timer dummy
scoreboard objectives add zip.constant dummy
scoreboard players set 0 zip.constant 0
scoreboard players set 1 zip.constant 1
execute as @a at @s run execute unless entity @e[type=marker,tag=front_zipline] run scoreboard players set @s zip.count 0
schedule function zipline:tick_10t 10t
schedule function zipline:tick_5t 5t