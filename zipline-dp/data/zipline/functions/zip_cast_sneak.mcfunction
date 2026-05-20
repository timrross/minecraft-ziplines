#built using mc-build (https://github.com/mc-build/mc-build)

execute positioned ^ ^ ^.5 if block ~ ~ ~ minecraft:iron_block run function zipline:__generated__/block/19
execute as @s[distance=..6] positioned ^ ^ ^0.5 if block ~ ~ ~ #zipline:zip_through_blocks run function zipline:zip_cast_sneak