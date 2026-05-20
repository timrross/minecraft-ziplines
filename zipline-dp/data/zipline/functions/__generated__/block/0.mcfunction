#built using mc-build (https://github.com/mc-build/mc-build)

tellraw @p {"text":"Zipline Removed!","bold":true,"color":"red"}
execute as @s[scores={zip.count=1}] run execute as @e[type=marker,scores={zip.count=1}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=2}] run execute as @e[type=marker,scores={zip.count=2}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=3}] run execute as @e[type=marker,scores={zip.count=3}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=4}] run execute as @e[type=marker,scores={zip.count=4}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=5}] run execute as @e[type=marker,scores={zip.count=5}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=6}] run execute as @e[type=marker,scores={zip.count=6}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=7}] run execute as @e[type=marker,scores={zip.count=7}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=8}] run execute as @e[type=marker,scores={zip.count=8}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=9}] run execute as @e[type=marker,scores={zip.count=9}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=10}] run execute as @e[type=marker,scores={zip.count=10}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=11}] run execute as @e[type=marker,scores={zip.count=11}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=12}] run execute as @e[type=marker,scores={zip.count=12}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=13}] run execute as @e[type=marker,scores={zip.count=13}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=14}] run execute as @e[type=marker,scores={zip.count=14}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=15}] run execute as @e[type=marker,scores={zip.count=15}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=16}] run execute as @e[type=marker,scores={zip.count=16}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=17}] run execute as @e[type=marker,scores={zip.count=17}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=18}] run execute as @e[type=marker,scores={zip.count=18}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=19}] run execute as @e[type=marker,scores={zip.count=19}] at @s run function zipline:remove_marker
execute as @s[scores={zip.count=20}] run execute as @e[type=marker,scores={zip.count=20}] at @s run function zipline:remove_marker
kill @s
summon item ~ ~ ~ {Item:{id:"minecraft:iron_ingot",Count:7b}}
playsound block.note_block.guitar master @a ~ ~ ~ .5 1.5
tag @e[type=marker,tag=front_zipline] add reset
scoreboard players set @e[type=marker,tag=front_zipline] zip.count 0
scoreboard players set @e[type=marker,tag=end_zipline] zip.count 0
tag @e[type=marker,tag=end_zipline] remove marked
scoreboard players set @p zip.count 0
forceload remove ~ ~
scoreboard players reset @s lub.rightclick