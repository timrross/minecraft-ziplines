#built using mc-build (https://github.com/mc-build/mc-build)

effect give @s levitation 1 255 true
execute as @s[scores={zip.move=1}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=1}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=2}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=2}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=3}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=3}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=4}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=4}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=5}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=5}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=6}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=6}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=7}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=7}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=8}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=8}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=9}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=9}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=10}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=10}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=11}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=11}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=12}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=12}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=13}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=13}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=14}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=14}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=15}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=15}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=16}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=16}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=17}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=17}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=18}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=18}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=19}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=19}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s[scores={zip.move=19}] at @s facing entity @e[type=marker,tag=end_zipline,scores={zip.count=19}] feet run tp @s ^ ^ ^.5 ~ 0
execute as @s at @s run tp @s ~ ~-.1 ~
playsound block.candle.extinguish master @a ~ ~ ~ .21 2
playsound block.amethyst_block.chime master @a ~ ~ ~ 1 1.4
playsound block.amethyst_block.chime master @a ~ ~ ~ 1 1.4
playsound block.amethyst_block.chime master @a ~ ~ ~ 1 1.4
execute if entity @e[type=marker,tag=end_zipline,distance=..1.5] run function zipline:__generated__/block/13
scoreboard players remove @s[scores={zip.timer=1..}] zip.timer 1
scoreboard players set @s[scores={lub.rightclick=1..}] zip.timer 5
scoreboard players set @s lub.rightclick 0
execute as @s[scores={zip.timer=..1}] at @s run function zipline:__generated__/block/14