#built using mc-build (https://github.com/mc-build/mc-build)

tag @s add marked
tag @s add temp1
scoreboard players set @s zip.count 0
execute as @e[type=marker,tag=marked] run scoreboard players add @e[type=marker,tag=temp1] zip.count 1
tag @s remove temp1
forceload add ~ ~