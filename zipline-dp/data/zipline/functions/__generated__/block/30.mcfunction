#built using mc-build (https://github.com/mc-build/mc-build)

scoreboard players set @p[tag=used_hook,distance=..7] zip.move 7
execute facing entity @e[type=marker,tag=end_zipline,scores={zip.count=7..7}] eyes run tp @p ~ ~-2 ~ ~ ~