#built using mc-build (https://github.com/mc-build/mc-build)

tag @s remove zipline_start
tag @s add front_zipline
tag @s add temp0
scoreboard players reset @s zip.count
scoreboard players set @p zip.count 0
forceload add ~ ~
execute as @e[type=marker,tag=front_zipline] run scoreboard players add @e[type=marker,tag=temp0] zip.count 1
execute as @e[type=marker,tag=front_zipline] run scoreboard players add @p zip.count 1
execute facing entity @e[type=marker,tag=zipline_end,limit=1,sort=nearest] feet run tp @s ~ ~ ~ ~ ~
tag @s remove temp0