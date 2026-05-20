#built using mc-build (https://github.com/mc-build/mc-build)

tag @s remove reset
scoreboard players set @s zip.count 0
tag @s add temp2
forceload add ~ ~
execute as @e[type=marker,tag=front_zipline,tag=!reset] run scoreboard players add @e[type=marker,tag=temp2] zip.count 1
scoreboard players set @p zip.count 0
execute as @e[type=marker,tag=front_zipline] run scoreboard players add @p zip.count 1
tag @s remove temp2