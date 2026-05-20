#built using mc-build (https://github.com/mc-build/mc-build)

execute as @e[type=marker,tag=zipline_start] at @s run function zipline:__generated__/block/9
tag @s add end_zipline
tag @s remove zipline_end