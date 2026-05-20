#built using mc-build (https://github.com/mc-build/mc-build)

execute positioned ^ ^ ^.25 run particle dust 0 0 0 .8 ~ ~ ~ 0.05 0.05 0.05 0 3 force @a[distance=..100]
execute positioned ^ ^ ^.25 run execute as @e[type=marker,tag=end_zipline,distance=..0.3,tag=!marked] at @s run function zipline:__generated__/block/21
execute as @s[distance=..100] positioned ^ ^ ^0.25 if block ~ ~ ~ #zipline:zip_through_blocks unless entity @e[type=marker,tag=end_zipline,distance=...25] run function zipline:zip_line_wire